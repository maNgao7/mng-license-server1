#define VK_NO_PROTOTYPES
#include <vulkan/vk_layer.h>
#include <windows.h>
#include <bcrypt.h>
#include <stdint.h>
#include <string.h>
#include <wchar.h>
#include "kit_module.h"

// Private sparring renderer. Vulkan creates and owns all dispatchable objects.
// Bind each forwarding table to the loader's dispatch key for its lifetime.
typedef struct Dispatch {
    void *key;
    VkInstance instance;
    PFN_vkGetInstanceProcAddr instanceProc;
    PFN_GetPhysicalDeviceProcAddr physicalProc;
    PFN_vkGetDeviceProcAddr deviceProc;
    struct Dispatch *next;
} Dispatch;
static SRWLOCK tableLock = SRWLOCK_INIT;
static Dispatch *tables;

static void remember(Dispatch *table, void *object) {
    table->key = *(void **)object;
    AcquireSRWLockExclusive(&tableLock);
    table->next = tables;
    tables = table;
    ReleaseSRWLockExclusive(&tableLock);
}
static Dispatch lookup(void *object) {
    Dispatch copy = {0};
    if (!object) return copy;
    AcquireSRWLockShared(&tableLock);
    for (Dispatch *t = tables; t; t = t->next)
        if (t->key == *(void **)object) { copy = *t; break; }
    ReleaseSRWLockShared(&tableLock);
    return copy;
}
static void forget(void *object) {
    AcquireSRWLockExclusive(&tableLock);
    for (Dispatch **p = &tables; *p; p = &(*p)->next) {
        if ((*p)->key != *(void **)object) continue;
        Dispatch *old = *p;
        *p = old->next;
        HeapFree(GetProcessHeap(), 0, old);
        break;
    }
    ReleaseSRWLockExclusive(&tableLock);
}
static void *linkInfo(const void *next, VkStructureType type) {
    for (const VkBaseInStructure *p = next; p; p = p->pNext) {
        if (p->sType != type) continue;
        if (type == VK_STRUCTURE_TYPE_LOADER_INSTANCE_CREATE_INFO) {
            if (((const VkLayerInstanceCreateInfo *)p)->function == VK_LAYER_LINK_INFO) return (void *)p;
        } else if (((const VkLayerDeviceCreateInfo *)p)->function == VK_LAYER_LINK_INFO) return (void *)p;
    }
    return NULL;
}
static VkResult VKAPI_CALL createInstance(const VkInstanceCreateInfo *info, const VkAllocationCallbacks *a, VkInstance *out) {
    VkLayerInstanceCreateInfo *link = linkInfo(info->pNext, VK_STRUCTURE_TYPE_LOADER_INSTANCE_CREATE_INFO);
    if (!link || !link->u.pLayerInfo) return VK_ERROR_INITIALIZATION_FAILED;
    VkLayerInstanceLink *next = link->u.pLayerInfo;
    link->u.pLayerInfo = next->pNext;
    Dispatch *t = HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, sizeof(*t));
    if (!t) return VK_ERROR_OUT_OF_HOST_MEMORY;
    t->instanceProc = next->pfnNextGetInstanceProcAddr;
    t->physicalProc = next->pfnNextGetPhysicalDeviceProcAddr;
    PFN_vkCreateInstance create = (PFN_vkCreateInstance)t->instanceProc(NULL, "vkCreateInstance");
    VkResult result = create(info, a, out);
    if (result == VK_SUCCESS) { t->instance = *out; remember(t, *out); }
    else HeapFree(GetProcessHeap(), 0, t);
    return result;
}
static VkResult VKAPI_CALL createDevice(VkPhysicalDevice gpu, const VkDeviceCreateInfo *info, const VkAllocationCallbacks *a, VkDevice *out) {
    VkLayerDeviceCreateInfo *link = linkInfo(info->pNext, VK_STRUCTURE_TYPE_LOADER_DEVICE_CREATE_INFO);
    Dispatch parent = lookup(gpu);
    if (!link || !link->u.pLayerInfo || !parent.instance) return VK_ERROR_INITIALIZATION_FAILED;
    VkLayerDeviceLink *next = link->u.pLayerInfo;
    link->u.pLayerInfo = next->pNext;
    Dispatch *t = HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, sizeof(*t));
    if (!t) return VK_ERROR_OUT_OF_HOST_MEMORY;
    t->deviceProc = next->pfnNextGetDeviceProcAddr;
    PFN_vkCreateDevice create = (PFN_vkCreateDevice)next->pfnNextGetInstanceProcAddr(parent.instance,"vkCreateDevice");
    VkResult result = create(gpu, info, a, out);
    if (result == VK_SUCCESS) remember(t, *out);
    else HeapFree(GetProcessHeap(), 0, t);
    return result;
}
static void VKAPI_CALL destroyInstance(VkInstance instance, const VkAllocationCallbacks *a) {
    if (!instance) return;
    PFN_vkDestroyInstance destroy = (PFN_vkDestroyInstance)lookup(instance).instanceProc(instance,"vkDestroyInstance");
    forget(instance);
    destroy(instance, a);
}
static void VKAPI_CALL destroyDevice(VkDevice device, const VkAllocationCallbacks *a) {
    if (!device) return;
    PFN_vkDestroyDevice destroy = (PFN_vkDestroyDevice)lookup(device).deviceProc(device,"vkDestroyDevice");
    forget(device);
    destroy(device, a);
}
static int canonicalExecutablePath(const WCHAR *path, WCHAR *canonical, DWORD capacity) {
    // Require an explicit drive or UNC path; do not resolve relative paths via cwd.
    if (!path || !path[0]) return 0;
    int drive = ((path[0] >= L'A' && path[0] <= L'Z') ||
                 (path[0] >= L'a' && path[0] <= L'z')) && path[1] == L':' &&
                (path[2] == L'\\' || path[2] == L'/');
    int unc = (path[0] == L'\\' || path[0] == L'/') &&
              (path[1] == L'\\' || path[1] == L'/');
    if (!drive && !unc) return 0;
    HANDLE file = CreateFileW(path, FILE_READ_ATTRIBUTES,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, NULL,
        OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (file == INVALID_HANDLE_VALUE) return 0;
    DWORD length = GetFinalPathNameByHandleW(file, canonical, capacity,
        FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
    CloseHandle(file);
    return length > 0 && length < capacity;
}
static int gameProcessMatches(void) {
    WCHAR exe[32768], expected[32768];
    DWORD length = GetModuleFileNameW(NULL, exe, 32768);
    if (!length || length >= 32768) return 0;
    SetLastError(ERROR_SUCCESS);
    length = GetEnvironmentVariableW(L"TIKMNG_RING_NATIVE_GAME", expected, 32768);
    if (!length) {
        if (GetLastError() != ERROR_ENVVAR_NOT_FOUND) return 0;
        wcscpy(expected, L"D:\\TikMnG\\Hediye-Box-Private\\native-game\\boxing.exe");
    } else if (length >= 32768) return 0;
    // The worker verifies the game's hash before spawning it. Restrict this
    // process-local layer to that exact canonical executable, including aliases.
    if (!canonicalExecutablePath(exe, exe, 32768) ||
        !canonicalExecutablePath(expected, expected, 32768)) return 0;
    return _wcsicmp(exe, expected) == 0;
}
static int kitMatches(const VkShaderModuleCreateInfo *info) {
    if (info->codeSize != ORIGINAL_BYTES) return 0;
    if (!gameProcessMatches()) return 0;
    BYTE digest[32];
    BCRYPT_ALG_HANDLE alg = NULL;
    BCRYPT_HASH_HANDLE hash = NULL;
    NTSTATUS status = BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, NULL, 0);
    if (status >= 0) status = BCryptCreateHash(alg, &hash, NULL, 0, NULL, 0, 0);
    if (status >= 0) status = BCryptHashData(hash, (PUCHAR)info->pCode, (ULONG)info->codeSize, 0);
    if (status >= 0) status = BCryptFinishHash(hash, digest, sizeof digest, 0);
    if (hash) BCryptDestroyHash(hash);
    if (alg) BCryptCloseAlgorithmProvider(alg, 0);
    return status >= 0 && !memcmp(digest, originalDigest, sizeof digest);
}
static VkResult VKAPI_CALL createShader(VkDevice device, const VkShaderModuleCreateInfo *info,
                                        const VkAllocationCallbacks *a, VkShaderModule *out) {
    PFN_vkCreateShaderModule create = (PFN_vkCreateShaderModule)lookup(device).deviceProc(device,"vkCreateShaderModule");
    if (kitMatches(info)) {
        VkShaderModuleCreateInfo kit = *info;
        kit.pCode = kitWords;
        kit.codeSize = sizeof kitWords;
        VkResult ok = create(device, &kit, a, out);
        if (ok == VK_SUCCESS) return ok;
    }
    return create(device, info, a, out);
}
static PFN_vkVoidFunction VKAPI_CALL deviceProc(VkDevice device, const char *name);
static PFN_vkVoidFunction VKAPI_CALL instanceProc(VkInstance instance, const char *name);
#define EXPOSE(name, impl) if (strcmp(request, name) == 0) return (PFN_vkVoidFunction)impl
static PFN_vkVoidFunction VKAPI_CALL deviceProc(VkDevice device, const char *request) {
    EXPOSE("vkGetDeviceProcAddr", deviceProc);
    EXPOSE("vkCreateShaderModule", createShader);
    EXPOSE("vkDestroyDevice", destroyDevice);
    Dispatch t = lookup(device);
    return t.deviceProc ? t.deviceProc(device, request) : NULL;
}
static PFN_vkVoidFunction VKAPI_CALL instanceProc(VkInstance instance, const char *request) {
    EXPOSE("vkGetInstanceProcAddr", instanceProc);
    EXPOSE("vkCreateInstance", createInstance);
    EXPOSE("vkCreateDevice", createDevice);
    EXPOSE("vkDestroyInstance", destroyInstance);
    EXPOSE("vkGetDeviceProcAddr", deviceProc);
    EXPOSE("vkCreateShaderModule", createShader);
    EXPOSE("vkDestroyDevice", destroyDevice);
    Dispatch t = lookup(instance);
    return t.instanceProc ? t.instanceProc(instance, request) : NULL;
}
static PFN_vkVoidFunction VKAPI_CALL physicalProc(VkInstance instance, const char *request) {
    Dispatch t = lookup(instance);
    return t.physicalProc ? t.physicalProc(instance, request) : NULL;
}
__declspec(dllexport) VKAPI_ATTR VkResult VKAPI_CALL vkNegotiateLoaderLayerInterfaceVersion(VkNegotiateLayerInterface *iface) {
    if (!iface || iface->loaderLayerInterfaceVersion < 2) return VK_ERROR_INITIALIZATION_FAILED;
    iface->loaderLayerInterfaceVersion = 2;
    iface->pfnGetInstanceProcAddr = instanceProc;
    iface->pfnGetDeviceProcAddr = deviceProc;
    iface->pfnGetPhysicalDeviceProcAddr = physicalProc;
    return VK_SUCCESS;
}
