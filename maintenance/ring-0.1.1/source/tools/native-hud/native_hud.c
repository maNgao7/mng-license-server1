#define VK_NO_PROTOTYPES
#include <vulkan/vk_layer.h>
#include <windows.h>
#include <stdint.h>
#include <string.h>
#include "hud_reader.h"
#include "hud_shaders.h"

#define TEX_W 1920u
#define TEX_H 1080u
#define TEX_BYTES ((VkDeviceSize)TEX_W*TEX_H*4)
typedef struct ImageSlot {
    VkImage image, texture;
    VkImageView targetView, textureView;
    VkDeviceMemory textureMemory, bufferMemory;
    VkBuffer buffer;
    VkFramebuffer framebuffer;
    VkDescriptorSet descriptor;
    VkCommandPool pool;
    VkCommandBuffer command;
    VkFence fence;
} ImageSlot;
typedef struct Swap {
    VkSwapchainKHR handle;
    VkExtent2D extent;
    VkFormat format;
    uint32_t count;
    ImageSlot *images;
    VkRenderPass renderPass;
    VkDescriptorPool descriptorPool;
    VkDescriptorSetLayout descriptorLayout;
    VkPipelineLayout layout;
    VkPipeline pipeline;
    VkSampler sampler;
    int ready, disabled;
    struct Swap *next;
} Swap;
typedef struct Dispatch {
    void *key;
    VkInstance instance;
    VkDevice device;
    PFN_vkGetInstanceProcAddr gip;
    PFN_vkGetDeviceProcAddr gdp;
    PFN_GetPhysicalDeviceProcAddr gpp;
    PFN_vkSetDeviceLoaderData setLoaderData;
    VkPhysicalDeviceMemoryProperties memory;
    Swap *swaps;
    HudReader reader;
    SRWLOCK drawLock;
    int logged;
    uint32_t graphicsFamily;
    struct {VkCommandBuffer command; VkImage image;} tracked[512];
    struct {VkQueue queue; uint32_t family;} queues[32];
    uint32_t queueCount;
    struct Dispatch *next;
} Dispatch;
static Dispatch *tables;
static SRWLOCK tablesLock=SRWLOCK_INIT;
#define FN(d,n) ((PFN_##n)(d)->gdp((d)->device,#n))
#define CALL(d,n,...) FN(d,n)(__VA_ARGS__)
static void logLine(const char *text) {
    WCHAR path[32768]; DWORD n=GetEnvironmentVariableW(L"TIKMNG_HUD_LOG",path,32768);
    if(!n||n>=32768)return;
    HANDLE f=CreateFileW(path,FILE_APPEND_DATA,FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,NULL,OPEN_ALWAYS,FILE_ATTRIBUTE_NORMAL,NULL);
    if(f==INVALID_HANDLE_VALUE)return;
    DWORD written; WriteFile(f,text,(DWORD)strlen(text),&written,NULL);WriteFile(f,"\n",1,&written,NULL);CloseHandle(f);
}
static Dispatch *lookup(void *object) {
    if(!object)return NULL;
    void *key=*(void**)object; Dispatch *found=NULL;
    AcquireSRWLockShared(&tablesLock);
    for(Dispatch *d=tables;d;d=d->next)if(d->key==key){found=d;break;}
    ReleaseSRWLockShared(&tablesLock);return found;
}
static void remember(Dispatch *d,void *object) {
    d->key=*(void**)object;InitializeSRWLock(&d->drawLock);
    AcquireSRWLockExclusive(&tablesLock);d->next=tables;tables=d;ReleaseSRWLockExclusive(&tablesLock);
}
static void forget(Dispatch *d) {
    AcquireSRWLockExclusive(&tablesLock);
    for(Dispatch **p=&tables;*p;p=&(*p)->next)if(*p==d){*p=d->next;break;}
    ReleaseSRWLockExclusive(&tablesLock);HeapFree(GetProcessHeap(),0,d);
}
static void *linkInfo(const void *next,VkStructureType type) {
    for(const VkBaseInStructure *p=next;p;p=p->pNext)if(p->sType==type){
        if(type==VK_STRUCTURE_TYPE_LOADER_INSTANCE_CREATE_INFO){if(((const VkLayerInstanceCreateInfo*)p)->function==VK_LAYER_LINK_INFO)return(void*)p;}
        else if(((const VkLayerDeviceCreateInfo*)p)->function==VK_LAYER_LINK_INFO)return(void*)p;
    }return NULL;
}
static VkResult VKAPI_CALL createInstance(const VkInstanceCreateInfo *info,const VkAllocationCallbacks *a,VkInstance *out) {
    VkLayerInstanceCreateInfo *link=linkInfo(info->pNext,VK_STRUCTURE_TYPE_LOADER_INSTANCE_CREATE_INFO);
    if(!link||!link->u.pLayerInfo)return VK_ERROR_INITIALIZATION_FAILED;
    VkLayerInstanceLink *next=link->u.pLayerInfo;link->u.pLayerInfo=next->pNext;
    Dispatch *d=HeapAlloc(GetProcessHeap(),HEAP_ZERO_MEMORY,sizeof(*d));if(!d)return VK_ERROR_OUT_OF_HOST_MEMORY;
    d->gip=next->pfnNextGetInstanceProcAddr;d->gpp=next->pfnNextGetPhysicalDeviceProcAddr;
    VkResult r=((PFN_vkCreateInstance)d->gip(NULL,"vkCreateInstance"))(info,a,out);
    if(r==VK_SUCCESS){d->instance=*out;remember(d,*out);}else HeapFree(GetProcessHeap(),0,d);
    return r;
}
static VkResult VKAPI_CALL createDevice(VkPhysicalDevice gpu,const VkDeviceCreateInfo *info,const VkAllocationCallbacks *a,VkDevice *out) {
    VkLayerDeviceCreateInfo *link=linkInfo(info->pNext,VK_STRUCTURE_TYPE_LOADER_DEVICE_CREATE_INFO);
    Dispatch *parent=lookup(gpu);if(!link||!link->u.pLayerInfo||!parent)return VK_ERROR_INITIALIZATION_FAILED;
    VkLayerDeviceLink *next=link->u.pLayerInfo;link->u.pLayerInfo=next->pNext;
    Dispatch *d=HeapAlloc(GetProcessHeap(),HEAP_ZERO_MEMORY,sizeof(*d));if(!d)return VK_ERROR_OUT_OF_HOST_MEMORY;
    d->gdp=next->pfnNextGetDeviceProcAddr;
    for(const VkBaseInStructure *p=info->pNext;p;p=p->pNext)if(p->sType==VK_STRUCTURE_TYPE_LOADER_DEVICE_CREATE_INFO){
      const VkLayerDeviceCreateInfo *li=(const VkLayerDeviceCreateInfo*)p;
      if(li->function==VK_LOADER_DATA_CALLBACK)d->setLoaderData=li->u.pfnSetDeviceLoaderData;
    }
    VkResult r=((PFN_vkCreateDevice)next->pfnNextGetInstanceProcAddr(parent->instance,"vkCreateDevice"))(gpu,info,a,out);
    if(r==VK_SUCCESS){d->device=*out;((PFN_vkGetPhysicalDeviceMemoryProperties)parent->gip(parent->instance,"vkGetPhysicalDeviceMemoryProperties"))(gpu,&d->memory);
      VkQueueFamilyProperties families[64];uint32_t count=64;
      ((PFN_vkGetPhysicalDeviceQueueFamilyProperties)parent->gip(parent->instance,"vkGetPhysicalDeviceQueueFamilyProperties"))(gpu,&count,families);
      d->graphicsFamily=UINT32_MAX;
      for(uint32_t q=0;q<info->queueCreateInfoCount;q++){uint32_t f=info->pQueueCreateInfos[q].queueFamilyIndex;if(f<count&&(families[f].queueFlags&VK_QUEUE_GRAPHICS_BIT)){d->graphicsFamily=f;break;}}
      remember(d,*out);logLine("Native HUD device initialized");}
    else HeapFree(GetProcessHeap(),0,d);return r;
}
static uint32_t memoryType(Dispatch *d,uint32_t bits) {
    for(uint32_t i=0;i<d->memory.memoryTypeCount;i++)if((bits&(1u<<i))&&(d->memory.memoryTypes[i].propertyFlags&VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT))return i;
    for(uint32_t i=0;i<d->memory.memoryTypeCount;i++)if(bits&(1u<<i))return i;return UINT32_MAX;
}
static int allocate(Dispatch *d,VkMemoryRequirements req,VkDeviceMemory *out) {
    uint32_t type=memoryType(d,req.memoryTypeBits);if(type==UINT32_MAX)return 0;
    VkMemoryAllocateInfo a={.sType=VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO,.allocationSize=req.size,.memoryTypeIndex=type};
    return CALL(d,vkAllocateMemory,d->device,&a,NULL,out)==VK_SUCCESS;
}
static void cleanSwap(Dispatch *d,Swap *s) {
    for(uint32_t i=0;i<s->count;i++){
        ImageSlot *p=&s->images[i];
        if(p->fence)CALL(d,vkDestroyFence,d->device,p->fence,NULL);
        if(p->pool)CALL(d,vkDestroyCommandPool,d->device,p->pool,NULL);
        if(p->framebuffer)CALL(d,vkDestroyFramebuffer,d->device,p->framebuffer,NULL);
        if(p->textureView)CALL(d,vkDestroyImageView,d->device,p->textureView,NULL);
        if(p->targetView)CALL(d,vkDestroyImageView,d->device,p->targetView,NULL);
        if(p->texture)CALL(d,vkDestroyImage,d->device,p->texture,NULL);
        if(p->buffer)CALL(d,vkDestroyBuffer,d->device,p->buffer,NULL);
        if(p->textureMemory)CALL(d,vkFreeMemory,d->device,p->textureMemory,NULL);
        if(p->bufferMemory)CALL(d,vkFreeMemory,d->device,p->bufferMemory,NULL);
    }
    if(s->pipeline)CALL(d,vkDestroyPipeline,d->device,s->pipeline,NULL);
    if(s->layout)CALL(d,vkDestroyPipelineLayout,d->device,s->layout,NULL);
    if(s->descriptorPool)CALL(d,vkDestroyDescriptorPool,d->device,s->descriptorPool,NULL);
    if(s->descriptorLayout)CALL(d,vkDestroyDescriptorSetLayout,d->device,s->descriptorLayout,NULL);
    if(s->sampler)CALL(d,vkDestroySampler,d->device,s->sampler,NULL);
    if(s->renderPass)CALL(d,vkDestroyRenderPass,d->device,s->renderPass,NULL);
    if(s->images)HeapFree(GetProcessHeap(),0,s->images);
    s->images=NULL;s->count=0;
}
#define CHECK(expr) do{if((expr)!=VK_SUCCESS)return 0;}while(0)
static int prepare(Dispatch *d,Swap *s) {
    VkAttachmentDescription attachment={.format=s->format,.samples=VK_SAMPLE_COUNT_1_BIT,.loadOp=VK_ATTACHMENT_LOAD_OP_LOAD,
      .storeOp=VK_ATTACHMENT_STORE_OP_STORE,.stencilLoadOp=VK_ATTACHMENT_LOAD_OP_DONT_CARE,.stencilStoreOp=VK_ATTACHMENT_STORE_OP_DONT_CARE,
      .initialLayout=VK_IMAGE_LAYOUT_PRESENT_SRC_KHR,.finalLayout=VK_IMAGE_LAYOUT_PRESENT_SRC_KHR};
    VkAttachmentReference color={0,VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL};
    VkSubpassDescription sub={.pipelineBindPoint=VK_PIPELINE_BIND_POINT_GRAPHICS,.colorAttachmentCount=1,.pColorAttachments=&color};
    VkSubpassDependency deps[2]={{.srcSubpass=VK_SUBPASS_EXTERNAL,.dstSubpass=0,.srcStageMask=VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,
      .dstStageMask=VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT,.srcAccessMask=VK_ACCESS_MEMORY_WRITE_BIT,.dstAccessMask=VK_ACCESS_COLOR_ATTACHMENT_READ_BIT|VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT},
      {.srcSubpass=0,.dstSubpass=VK_SUBPASS_EXTERNAL,.srcStageMask=VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT,.dstStageMask=VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,
       .srcAccessMask=VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT,.dstAccessMask=VK_ACCESS_MEMORY_READ_BIT}};
    VkRenderPassCreateInfo rp={.sType=VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO,.attachmentCount=1,.pAttachments=&attachment,.subpassCount=1,.pSubpasses=&sub,.dependencyCount=2,.pDependencies=deps};
    CHECK(CALL(d,vkCreateRenderPass,d->device,&rp,NULL,&s->renderPass));
    VkDescriptorSetLayoutBinding binding={.binding=0,.descriptorType=VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER,.descriptorCount=1,.stageFlags=VK_SHADER_STAGE_FRAGMENT_BIT};
    VkDescriptorSetLayoutCreateInfo ds={.sType=VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO,.bindingCount=1,.pBindings=&binding};
    CHECK(CALL(d,vkCreateDescriptorSetLayout,d->device,&ds,NULL,&s->descriptorLayout));
    VkPushConstantRange push={VK_SHADER_STAGE_FRAGMENT_BIT,0,12};
    VkPipelineLayoutCreateInfo pl={.sType=VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO,.setLayoutCount=1,.pSetLayouts=&s->descriptorLayout,.pushConstantRangeCount=1,.pPushConstantRanges=&push};
    CHECK(CALL(d,vkCreatePipelineLayout,d->device,&pl,NULL,&s->layout));
    VkSamplerCreateInfo sampler={.sType=VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO,.magFilter=VK_FILTER_LINEAR,.minFilter=VK_FILTER_LINEAR,
      .mipmapMode=VK_SAMPLER_MIPMAP_MODE_NEAREST,.addressModeU=VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE,.addressModeV=VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE,.addressModeW=VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE};
    CHECK(CALL(d,vkCreateSampler,d->device,&sampler,NULL,&s->sampler));
    VkShaderModule vert=0,frag=0;
    VkShaderModuleCreateInfo shader={.sType=VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO,.codeSize=sizeof(hud_vert),.pCode=hud_vert};
    CHECK(CALL(d,vkCreateShaderModule,d->device,&shader,NULL,&vert));
    shader.codeSize=sizeof(hud_frag);shader.pCode=hud_frag;
    VkResult r=CALL(d,vkCreateShaderModule,d->device,&shader,NULL,&frag);
    if(r!=VK_SUCCESS){CALL(d,vkDestroyShaderModule,d->device,vert,NULL);return 0;}
    VkPipelineShaderStageCreateInfo stages[2]={{.sType=VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO,.stage=VK_SHADER_STAGE_VERTEX_BIT,.module=vert,.pName="main"},
      {.sType=VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO,.stage=VK_SHADER_STAGE_FRAGMENT_BIT,.module=frag,.pName="main"}};
    VkPipelineVertexInputStateCreateInfo vi={.sType=VK_STRUCTURE_TYPE_PIPELINE_VERTEX_INPUT_STATE_CREATE_INFO};
    VkPipelineInputAssemblyStateCreateInfo ia={.sType=VK_STRUCTURE_TYPE_PIPELINE_INPUT_ASSEMBLY_STATE_CREATE_INFO,.topology=VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST};
    VkPipelineViewportStateCreateInfo vp={.sType=VK_STRUCTURE_TYPE_PIPELINE_VIEWPORT_STATE_CREATE_INFO,.viewportCount=1,.scissorCount=1};
    VkPipelineRasterizationStateCreateInfo rs={.sType=VK_STRUCTURE_TYPE_PIPELINE_RASTERIZATION_STATE_CREATE_INFO,.polygonMode=VK_POLYGON_MODE_FILL,.cullMode=VK_CULL_MODE_NONE,.frontFace=VK_FRONT_FACE_COUNTER_CLOCKWISE,.lineWidth=1};
    VkPipelineMultisampleStateCreateInfo ms={.sType=VK_STRUCTURE_TYPE_PIPELINE_MULTISAMPLE_STATE_CREATE_INFO,.rasterizationSamples=VK_SAMPLE_COUNT_1_BIT};
    VkPipelineColorBlendAttachmentState blend={.blendEnable=VK_TRUE,.srcColorBlendFactor=VK_BLEND_FACTOR_ONE,.dstColorBlendFactor=VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA,
      .colorBlendOp=VK_BLEND_OP_ADD,.srcAlphaBlendFactor=VK_BLEND_FACTOR_ONE,.dstAlphaBlendFactor=VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA,.alphaBlendOp=VK_BLEND_OP_ADD,.colorWriteMask=15};
    VkPipelineColorBlendStateCreateInfo cb={.sType=VK_STRUCTURE_TYPE_PIPELINE_COLOR_BLEND_STATE_CREATE_INFO,.attachmentCount=1,.pAttachments=&blend};
    VkDynamicState dynamics[]={VK_DYNAMIC_STATE_VIEWPORT,VK_DYNAMIC_STATE_SCISSOR};
    VkPipelineDynamicStateCreateInfo dyn={.sType=VK_STRUCTURE_TYPE_PIPELINE_DYNAMIC_STATE_CREATE_INFO,.dynamicStateCount=2,.pDynamicStates=dynamics};
    VkGraphicsPipelineCreateInfo gp={.sType=VK_STRUCTURE_TYPE_GRAPHICS_PIPELINE_CREATE_INFO,.stageCount=2,.pStages=stages,.pVertexInputState=&vi,.pInputAssemblyState=&ia,
      .pViewportState=&vp,.pRasterizationState=&rs,.pMultisampleState=&ms,.pColorBlendState=&cb,.pDynamicState=&dyn,.layout=s->layout,.renderPass=s->renderPass};
    r=CALL(d,vkCreateGraphicsPipelines,d->device,VK_NULL_HANDLE,1,&gp,NULL,&s->pipeline);
    CALL(d,vkDestroyShaderModule,d->device,vert,NULL);CALL(d,vkDestroyShaderModule,d->device,frag,NULL);
    CHECK(r);
    VkDescriptorPoolSize size={VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER,s->count};
    VkDescriptorPoolCreateInfo pool={.sType=VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO,.maxSets=s->count,.poolSizeCount=1,.pPoolSizes=&size};
    CHECK(CALL(d,vkCreateDescriptorPool,d->device,&pool,NULL,&s->descriptorPool));
    for(uint32_t i=0;i<s->count;i++){
      ImageSlot *p=&s->images[i];
      if(d->graphicsFamily==UINT32_MAX)return 0;
      VkCommandPoolCreateInfo cp={.sType=VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO,.flags=VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT,.queueFamilyIndex=d->graphicsFamily};
      CHECK(CALL(d,vkCreateCommandPool,d->device,&cp,NULL,&p->pool));
      VkCommandBufferAllocateInfo ca={.sType=VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO,.commandPool=p->pool,.level=VK_COMMAND_BUFFER_LEVEL_PRIMARY,.commandBufferCount=1};
      CHECK(CALL(d,vkAllocateCommandBuffers,d->device,&ca,&p->command));
      if(!d->setLoaderData)return 0;
      CHECK(d->setLoaderData(d->device,p->command));
      VkFenceCreateInfo fc={.sType=VK_STRUCTURE_TYPE_FENCE_CREATE_INFO,.flags=VK_FENCE_CREATE_SIGNALED_BIT};
      CHECK(CALL(d,vkCreateFence,d->device,&fc,NULL,&p->fence));
      VkImageViewCreateInfo iv={.sType=VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO,.image=p->image,.viewType=VK_IMAGE_VIEW_TYPE_2D,.format=s->format,
        .subresourceRange={VK_IMAGE_ASPECT_COLOR_BIT,0,1,0,1}};
      CHECK(CALL(d,vkCreateImageView,d->device,&iv,NULL,&p->targetView));
      VkFramebufferCreateInfo fb={.sType=VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO,.renderPass=s->renderPass,.attachmentCount=1,.pAttachments=&p->targetView,.width=s->extent.width,.height=s->extent.height,.layers=1};
      CHECK(CALL(d,vkCreateFramebuffer,d->device,&fb,NULL,&p->framebuffer));
      VkImageCreateInfo im={.sType=VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO,.imageType=VK_IMAGE_TYPE_2D,.format=VK_FORMAT_B8G8R8A8_UNORM,.extent={TEX_W,TEX_H,1},.mipLevels=1,.arrayLayers=1,.samples=VK_SAMPLE_COUNT_1_BIT,.tiling=VK_IMAGE_TILING_OPTIMAL,.usage=VK_IMAGE_USAGE_TRANSFER_DST_BIT|VK_IMAGE_USAGE_SAMPLED_BIT,.sharingMode=VK_SHARING_MODE_EXCLUSIVE};
      CHECK(CALL(d,vkCreateImage,d->device,&im,NULL,&p->texture));
      VkMemoryRequirements req;CALL(d,vkGetImageMemoryRequirements,d->device,p->texture,&req);
      if(!allocate(d,req,&p->textureMemory))return 0;
      CHECK(CALL(d,vkBindImageMemory,d->device,p->texture,p->textureMemory,0));
      iv.image=p->texture;iv.format=VK_FORMAT_B8G8R8A8_UNORM;
      CHECK(CALL(d,vkCreateImageView,d->device,&iv,NULL,&p->textureView));
      VkBufferCreateInfo b={.sType=VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO,.size=TEX_BYTES,.usage=VK_BUFFER_USAGE_TRANSFER_DST_BIT|VK_BUFFER_USAGE_TRANSFER_SRC_BIT,.sharingMode=VK_SHARING_MODE_EXCLUSIVE};
      CHECK(CALL(d,vkCreateBuffer,d->device,&b,NULL,&p->buffer));
      CALL(d,vkGetBufferMemoryRequirements,d->device,p->buffer,&req);
      if(!allocate(d,req,&p->bufferMemory))return 0;
      CHECK(CALL(d,vkBindBufferMemory,d->device,p->buffer,p->bufferMemory,0));
      VkDescriptorSetAllocateInfo da={.sType=VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO,.descriptorPool=s->descriptorPool,.descriptorSetCount=1,.pSetLayouts=&s->descriptorLayout};
      CHECK(CALL(d,vkAllocateDescriptorSets,d->device,&da,&p->descriptor));
      VkDescriptorImageInfo di={s->sampler,p->textureView,VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL};
      VkWriteDescriptorSet write={.sType=VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET,.dstSet=p->descriptor,.dstBinding=0,.descriptorCount=1,.descriptorType=VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER,.pImageInfo=&di};
      CALL(d,vkUpdateDescriptorSets,d->device,1,&write,0,NULL);
    }return 1;
}
static VkResult VKAPI_CALL createSwap(VkDevice device,const VkSwapchainCreateInfoKHR *info,const VkAllocationCallbacks *a,VkSwapchainKHR *out) {
    Dispatch *d=lookup(device);if(!d)return VK_ERROR_INITIALIZATION_FAILED;
    VkResult r=CALL(d,vkCreateSwapchainKHR,device,info,a,out);if(r!=VK_SUCCESS)return r;
    // Never alter the application's swapchain usage or presentation semantics.
    if(!(info->imageUsage&VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT)||info->imageArrayLayers!=1)return r;
    Swap *s=HeapAlloc(GetProcessHeap(),HEAP_ZERO_MEMORY,sizeof(*s));if(!s)return r;
    s->handle=*out;s->extent=info->imageExtent;s->format=info->imageFormat;
    uint32_t count=0;
    if(CALL(d,vkGetSwapchainImagesKHR,device,*out,&count,NULL)!=VK_SUCCESS||!count||count>16){HeapFree(GetProcessHeap(),0,s);return r;}
    VkImage images[16];
    if(CALL(d,vkGetSwapchainImagesKHR,device,*out,&count,images)!=VK_SUCCESS){HeapFree(GetProcessHeap(),0,s);return r;}
    s->images=HeapAlloc(GetProcessHeap(),HEAP_ZERO_MEMORY,count*sizeof(ImageSlot));
    if(!s->images){HeapFree(GetProcessHeap(),0,s);return r;}
    s->count=count;for(uint32_t i=0;i<count;i++)s->images[i].image=images[i];
    AcquireSRWLockExclusive(&d->drawLock);s->next=d->swaps;d->swaps=s;ReleaseSRWLockExclusive(&d->drawLock);return r;
}
static ImageSlot *recordHud(Dispatch *d,VkImage image) {
    Swap *s=NULL;ImageSlot *p=NULL;
    for(Swap *candidate=d->swaps;candidate&&!p;candidate=candidate->next)for(uint32_t i=0;i<candidate->count;i++)if(candidate->images[i].image==image){s=candidate;p=&candidate->images[i];break;}
    if(!p||s->disabled||!hud_snapshot(&d->reader)||d->reader.width>TEX_W||d->reader.height>TEX_H)return NULL;
    if(!s->ready){s->ready=prepare(d,s);if(!s->ready){s->disabled=1;logLine("Native HUD allocation/pipeline failed; original rendering continues");return NULL;}}
    if(CALL(d,vkGetFenceStatus,d->device,p->fence)!=VK_SUCCESS)return NULL;
    VkCommandBuffer cmd=p->command;
    if(CALL(d,vkResetCommandBuffer,cmd,0)!=VK_SUCCESS)return NULL;
    VkCommandBufferBeginInfo cbBegin={.sType=VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO,.flags=VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT};
    if(CALL(d,vkBeginCommandBuffer,cmd,&cbBegin)!=VK_SUCCESS)return NULL;
    // vkCmdUpdateBuffer copies the bytes at RECORD time. No mapped staging
    // memory is overwritten while another frame is using it on the GPU.
    {
    VkBufferMemoryBarrier buffer={.sType=VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER,.srcAccessMask=VK_ACCESS_TRANSFER_READ_BIT,.dstAccessMask=VK_ACCESS_TRANSFER_WRITE_BIT,
      .srcQueueFamilyIndex=VK_QUEUE_FAMILY_IGNORED,.dstQueueFamilyIndex=VK_QUEUE_FAMILY_IGNORED,.buffer=p->buffer,.size=VK_WHOLE_SIZE};
    CALL(d,vkCmdPipelineBarrier,cmd,VK_PIPELINE_STAGE_TRANSFER_BIT,VK_PIPELINE_STAGE_TRANSFER_BIT,0,0,NULL,1,&buffer,0,NULL);
    VkDeviceSize bytes=(VkDeviceSize)d->reader.width*d->reader.height*4;
    for(VkDeviceSize offset=0;offset<bytes;offset+=65536){VkDeviceSize n=bytes-offset;if(n>65536)n=65536;CALL(d,vkCmdUpdateBuffer,cmd,p->buffer,offset,n,d->reader.pixels+offset);}
    buffer.srcAccessMask=VK_ACCESS_TRANSFER_WRITE_BIT;buffer.dstAccessMask=VK_ACCESS_TRANSFER_READ_BIT;
    VkImageMemoryBarrier texture={.sType=VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER,.srcAccessMask=VK_ACCESS_SHADER_READ_BIT,.dstAccessMask=VK_ACCESS_TRANSFER_WRITE_BIT,
      .oldLayout=VK_IMAGE_LAYOUT_UNDEFINED,.newLayout=VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,.srcQueueFamilyIndex=VK_QUEUE_FAMILY_IGNORED,.dstQueueFamilyIndex=VK_QUEUE_FAMILY_IGNORED,
      .image=p->texture,.subresourceRange={VK_IMAGE_ASPECT_COLOR_BIT,0,1,0,1}};
    CALL(d,vkCmdPipelineBarrier,cmd,VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,VK_PIPELINE_STAGE_TRANSFER_BIT,0,0,NULL,1,&buffer,1,&texture);
    VkBufferImageCopy copy={.imageSubresource={VK_IMAGE_ASPECT_COLOR_BIT,0,0,1},.imageExtent={d->reader.width,d->reader.height,1}};
    CALL(d,vkCmdCopyBufferToImage,cmd,p->buffer,p->texture,VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,1,&copy);
    texture.srcAccessMask=VK_ACCESS_TRANSFER_WRITE_BIT;texture.dstAccessMask=VK_ACCESS_SHADER_READ_BIT;texture.oldLayout=VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;texture.newLayout=VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
    CALL(d,vkCmdPipelineBarrier,cmd,VK_PIPELINE_STAGE_TRANSFER_BIT,VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT,0,0,NULL,0,NULL,1,&texture);
    }
    VkRenderPassBeginInfo begin={.sType=VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO,.renderPass=s->renderPass,.framebuffer=p->framebuffer,.renderArea={{0,0},s->extent}};
    CALL(d,vkCmdBeginRenderPass,cmd,&begin,VK_SUBPASS_CONTENTS_INLINE);
    VkViewport viewport={0,0,(float)s->extent.width,(float)s->extent.height,0,1};VkRect2D scissor={{0,0},s->extent};
    CALL(d,vkCmdSetViewport,cmd,0,1,&viewport);CALL(d,vkCmdSetScissor,cmd,0,1,&scissor);
    CALL(d,vkCmdBindPipeline,cmd,VK_PIPELINE_BIND_POINT_GRAPHICS,s->pipeline);
    CALL(d,vkCmdBindDescriptorSets,cmd,VK_PIPELINE_BIND_POINT_GRAPHICS,s->layout,0,1,&p->descriptor,0,NULL);
    struct{float ratio[2];uint32_t srgb;}push={{(float)d->reader.width/TEX_W,(float)d->reader.height/TEX_H},s->format==VK_FORMAT_B8G8R8A8_SRGB||s->format==VK_FORMAT_R8G8B8A8_SRGB};
    CALL(d,vkCmdPushConstants,cmd,s->layout,VK_SHADER_STAGE_FRAGMENT_BIT,0,sizeof(push),&push);
    CALL(d,vkCmdDraw,cmd,3,1,0,0);CALL(d,vkCmdEndRenderPass,cmd);
    if(CALL(d,vkEndCommandBuffer,cmd)!=VK_SUCCESS)return NULL;
    return p;
}
static void track(Dispatch *d,VkCommandBuffer cmd,VkImage image){
    AcquireSRWLockExclusive(&d->drawLock);
    uint32_t slot=512,empty=512;
    for(uint32_t i=0;i<512;i++){if(d->tracked[i].command==cmd){slot=i;break;}if(!d->tracked[i].command&&empty==512)empty=i;}
    if(slot==512)slot=empty;
    // Beginning an unrelated command buffer must not consume a tracking slot.
    if(slot<512){d->tracked[slot].command=image?cmd:VK_NULL_HANDLE;d->tracked[slot].image=image;}
    ReleaseSRWLockExclusive(&d->drawLock);
}
static VkResult VKAPI_CALL beginCommand(VkCommandBuffer cmd,const VkCommandBufferBeginInfo *info){Dispatch *d=lookup(cmd);if(!d)return VK_ERROR_INITIALIZATION_FAILED;track(d,cmd,VK_NULL_HANDLE);return CALL(d,vkBeginCommandBuffer,cmd,info);}
static void VKAPI_CALL freeCommands(VkDevice device,VkCommandPool pool,uint32_t count,const VkCommandBuffer *commands){
    Dispatch *d=lookup(device);if(!d)return;
    AcquireSRWLockExclusive(&d->drawLock);
    for(uint32_t c=0;c<count;c++)for(uint32_t i=0;i<512;i++)if(d->tracked[i].command==commands[c]){d->tracked[i].command=VK_NULL_HANDLE;d->tracked[i].image=VK_NULL_HANDLE;}
    ReleaseSRWLockExclusive(&d->drawLock);CALL(d,vkFreeCommandBuffers,device,pool,count,commands);
}
static void rememberQueue(Dispatch *d,VkQueue queue,uint32_t family){
    AcquireSRWLockExclusive(&d->drawLock);if(d->queueCount<32){d->queues[d->queueCount].queue=queue;d->queues[d->queueCount++].family=family;}ReleaseSRWLockExclusive(&d->drawLock);
}
static void VKAPI_CALL getQueue(VkDevice device,uint32_t family,uint32_t index,VkQueue *queue){Dispatch *d=lookup(device);if(!d)return;CALL(d,vkGetDeviceQueue,device,family,index,queue);rememberQueue(d,*queue,family);}
static void VKAPI_CALL getQueue2(VkDevice device,const VkDeviceQueueInfo2 *info,VkQueue *queue){Dispatch *d=lookup(device);if(!d)return;CALL(d,vkGetDeviceQueue2,device,info,queue);rememberQueue(d,*queue,info->queueFamilyIndex);}
// Append once after the final recorded PRESENT transition. The private demo has
// multiple intermediate transitions; drawing at every barrier would double the
// HUD. Original wait/signal semaphores stay on the same submission, so capture
// observes the complete image before the game's render-finished signal fires.
static VkResult VKAPI_CALL submit(VkQueue queue,uint32_t count,const VkSubmitInfo *infos,VkFence fence){
    Dispatch *d=lookup(queue);if(!d)return VK_ERROR_INITIALIZATION_FAILED;
    AcquireSRWLockExclusive(&d->drawLock);
    int supported=0;for(uint32_t q=0;q<d->queueCount;q++)if(d->queues[q].queue==queue&&d->queues[q].family==d->graphicsFamily)supported=1;
    VkImage image=VK_NULL_HANDLE;uint32_t group=0;
    if(supported&&count<128)for(uint32_t g=0;g<count;g++)for(uint32_t c=0;c<infos[g].commandBufferCount;c++)for(uint32_t i=0;i<512;i++)if(d->tracked[i].command==infos[g].pCommandBuffers[c]&&d->tracked[i].image){image=d->tracked[i].image;group=g;break;}
    // Device-group/protected submissions require different command metadata.
    int extra=0;if(image)for(const VkBaseInStructure *p=infos[group].pNext;p;p=p->pNext)if(p->sType!=VK_STRUCTURE_TYPE_TIMELINE_SEMAPHORE_SUBMIT_INFO)extra=1;
    ImageSlot *p=image&&!extra?recordHud(d,image):NULL;
    if(!p){ReleaseSRWLockExclusive(&d->drawLock);return CALL(d,vkQueueSubmit,queue,count,infos,fence);}
    VkSubmitInfo modified[128];memcpy(modified,infos,count*sizeof(*infos));
    uint32_t nc=infos[group].commandBufferCount;
    VkCommandBuffer *commands=HeapAlloc(GetProcessHeap(),0,((size_t)nc+1)*sizeof(*commands));
    if(!commands){ReleaseSRWLockExclusive(&d->drawLock);return CALL(d,vkQueueSubmit,queue,count,infos,fence);}
    memcpy(commands,infos[group].pCommandBuffers,nc*sizeof(*commands));commands[nc]=p->command;
    modified[group].pCommandBuffers=commands;modified[group].commandBufferCount=nc+1;
    VkResult r=CALL(d,vkResetFences,d->device,1,&p->fence);
    if(r!=VK_SUCCESS){HeapFree(GetProcessHeap(),0,commands);ReleaseSRWLockExclusive(&d->drawLock);return CALL(d,vkQueueSubmit,queue,count,infos,fence);}
    if(r==VK_SUCCESS){
      r=CALL(d,vkQueueSubmit,queue,count,modified,fence?fence:p->fence);
      if(r==VK_SUCCESS&&fence){VkSubmitInfo tail={.sType=VK_STRUCTURE_TYPE_SUBMIT_INFO};VkResult tracked=CALL(d,vkQueueSubmit,queue,1,&tail,p->fence);if(tracked!=VK_SUCCESS)logLine("Native HUD fence tracking failed; slot will not be reused");}
      if(r==VK_SUCCESS&&!d->logged){d->logged=1;logLine("Native HUD recorded and submitted before game render-finished signal");}
    }
    HeapFree(GetProcessHeap(),0,commands);ReleaseSRWLockExclusive(&d->drawLock);return r;
}
static void VKAPI_CALL barrier(VkCommandBuffer cmd,VkPipelineStageFlags src,VkPipelineStageFlags dst,VkDependencyFlags flags,uint32_t mc,const VkMemoryBarrier *m,uint32_t bc,const VkBufferMemoryBarrier *b,uint32_t ic,const VkImageMemoryBarrier *im){
    Dispatch *d=lookup(cmd);if(!d)return;
    CALL(d,vkCmdPipelineBarrier,cmd,src,dst,flags,mc,m,bc,b,ic,im);
    for(uint32_t i=0;i<ic;i++)if(im[i].newLayout==VK_IMAGE_LAYOUT_PRESENT_SRC_KHR&&im[i].srcQueueFamilyIndex==im[i].dstQueueFamilyIndex)track(d,cmd,im[i].image);
}
static void barrier2Impl(VkCommandBuffer cmd,const VkDependencyInfo *info,const char *name){
    Dispatch *d=lookup(cmd);if(!d)return;
    ((PFN_vkCmdPipelineBarrier2)d->gdp(d->device,name))(cmd,info);
    for(uint32_t i=0;i<info->imageMemoryBarrierCount;i++){const VkImageMemoryBarrier2 *b=&info->pImageMemoryBarriers[i];if(b->newLayout==VK_IMAGE_LAYOUT_PRESENT_SRC_KHR&&b->srcQueueFamilyIndex==b->dstQueueFamilyIndex)track(d,cmd,b->image);}
}
static void VKAPI_CALL barrier2(VkCommandBuffer c,const VkDependencyInfo *i){barrier2Impl(c,i,"vkCmdPipelineBarrier2");}
static void VKAPI_CALL barrier2KHR(VkCommandBuffer c,const VkDependencyInfo *i){barrier2Impl(c,i,"vkCmdPipelineBarrier2KHR");}
static void VKAPI_CALL destroySwap(VkDevice device,VkSwapchainKHR swap,const VkAllocationCallbacks *a){
    Dispatch *d=lookup(device);if(!d)return;
    AcquireSRWLockExclusive(&d->drawLock);
    for(Swap **p=&d->swaps;*p;p=&(*p)->next)if((*p)->handle==swap){Swap *s=*p;*p=s->next;cleanSwap(d,s);HeapFree(GetProcessHeap(),0,s);break;}
    ReleaseSRWLockExclusive(&d->drawLock);CALL(d,vkDestroySwapchainKHR,device,swap,a);
}
static void VKAPI_CALL destroyDevice(VkDevice device,const VkAllocationCallbacks *a){
    Dispatch *d=lookup(device);if(!d)return;
    while(d->swaps){Swap *s=d->swaps;d->swaps=s->next;cleanSwap(d,s);HeapFree(GetProcessHeap(),0,s);}
    hud_close(&d->reader);PFN_vkDestroyDevice destroy=FN(d,vkDestroyDevice);forget(d);destroy(device,a);
}
static void VKAPI_CALL destroyInstance(VkInstance instance,const VkAllocationCallbacks *a){Dispatch *d=lookup(instance);if(!d)return;PFN_vkDestroyInstance destroy=(PFN_vkDestroyInstance)d->gip(instance,"vkDestroyInstance");forget(d);destroy(instance,a);}
static PFN_vkVoidFunction VKAPI_CALL instanceProc(VkInstance,const char*);
static PFN_vkVoidFunction VKAPI_CALL deviceProc(VkDevice,const char*);
#define EXPOSE(n,f) if(!strcmp(name,n))return(PFN_vkVoidFunction)f
static PFN_vkVoidFunction intercept(const char *name){
    EXPOSE("vkGetInstanceProcAddr",instanceProc);EXPOSE("vkGetDeviceProcAddr",deviceProc);
    EXPOSE("vkCreateInstance",createInstance);EXPOSE("vkCreateDevice",createDevice);
    EXPOSE("vkDestroyInstance",destroyInstance);EXPOSE("vkDestroyDevice",destroyDevice);
    EXPOSE("vkCreateSwapchainKHR",createSwap);EXPOSE("vkDestroySwapchainKHR",destroySwap);
    EXPOSE("vkBeginCommandBuffer",beginCommand);EXPOSE("vkFreeCommandBuffers",freeCommands);
    EXPOSE("vkGetDeviceQueue",getQueue);EXPOSE("vkGetDeviceQueue2",getQueue2);EXPOSE("vkQueueSubmit",submit);
    EXPOSE("vkCmdPipelineBarrier",barrier);EXPOSE("vkCmdPipelineBarrier2",barrier2);EXPOSE("vkCmdPipelineBarrier2KHR",barrier2KHR);return NULL;
}
static PFN_vkVoidFunction VKAPI_CALL deviceProc(VkDevice device,const char *name){Dispatch *d=lookup(device);PFN_vkVoidFunction f=intercept(name);return f?f:d?d->gdp(device,name):NULL;}
static PFN_vkVoidFunction VKAPI_CALL instanceProc(VkInstance instance,const char *name){Dispatch *d=lookup(instance);PFN_vkVoidFunction f=intercept(name);return f?f:d?d->gip(instance,name):NULL;}
static PFN_vkVoidFunction VKAPI_CALL physicalProc(VkInstance instance,const char *name){Dispatch *d=lookup(instance);return d&&d->gpp?d->gpp(instance,name):NULL;}
__declspec(dllexport) VKAPI_ATTR VkResult VKAPI_CALL vkNegotiateLoaderLayerInterfaceVersion(VkNegotiateLayerInterface *i){
    if(!i||i->loaderLayerInterfaceVersion<2)return VK_ERROR_INITIALIZATION_FAILED;
    i->loaderLayerInterfaceVersion=2;i->pfnGetInstanceProcAddr=instanceProc;i->pfnGetDeviceProcAddr=deviceProc;i->pfnGetPhysicalDeviceProcAddr=physicalProc;return VK_SUCCESS;
}
