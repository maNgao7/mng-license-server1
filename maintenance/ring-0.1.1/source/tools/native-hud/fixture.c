#define VK_NO_PROTOTYPES
#define VK_USE_PLATFORM_WIN32_KHR
#include <windows.h>
#include <vulkan/vulkan.h>
#include <stdio.h>
#include <stdlib.h>
#define ASSERT(x) do{if(!(x)){fprintf(stderr,"HUD fixture failure line %d: %s\n",__LINE__,#x);exit(1);}}while(0)
#define OK(x) ASSERT((x)==VK_SUCCESS)
#define I(name) PFN_##name name=(PFN_##name)gip(instance,#name)
#define D(name) PFN_##name name=(PFN_##name)gdp(device,#name)
int main(void){
 HMODULE loader=LoadLibraryW(L"vulkan-1.dll");ASSERT(loader);
 PFN_vkGetInstanceProcAddr gip=(PFN_vkGetInstanceProcAddr)GetProcAddress(loader,"vkGetInstanceProcAddr");ASSERT(gip);
 PFN_vkCreateInstance create=(PFN_vkCreateInstance)gip(NULL,"vkCreateInstance");
 const char *extensions[]={"VK_KHR_surface","VK_KHR_win32_surface"};
 VkApplicationInfo app={.sType=VK_STRUCTURE_TYPE_APPLICATION_INFO,.pApplicationName="TikMnG HUD isolated fixture",.apiVersion=VK_API_VERSION_1_1};
 VkInstanceCreateInfo ci={.sType=VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO,.pApplicationInfo=&app,.enabledExtensionCount=2,.ppEnabledExtensionNames=extensions};
 VkInstance instance;OK(create(&ci,NULL,&instance));
 I(vkEnumeratePhysicalDevices);I(vkGetPhysicalDeviceQueueFamilyProperties);I(vkGetPhysicalDeviceSurfaceSupportKHR);
 I(vkGetPhysicalDeviceSurfaceCapabilitiesKHR);I(vkGetPhysicalDeviceSurfaceFormatsKHR);I(vkGetPhysicalDeviceMemoryProperties);
 I(vkCreateDevice);I(vkCreateWin32SurfaceKHR);I(vkDestroySurfaceKHR);I(vkDestroyInstance);
 HINSTANCE module=GetModuleHandleW(NULL);WNDCLASSW wc={.lpfnWndProc=DefWindowProcW,.hInstance=module,.lpszClassName=L"TikMnGHudFixture"};RegisterClassW(&wc);
 HWND window=CreateWindowW(wc.lpszClassName,L"TikMnG hidden drawing check",WS_OVERLAPPEDWINDOW,0,0,1280,720,NULL,NULL,module,NULL);ASSERT(window);
 VkWin32SurfaceCreateInfoKHR sci={.sType=VK_STRUCTURE_TYPE_WIN32_SURFACE_CREATE_INFO_KHR,.hinstance=module,.hwnd=window};
 VkSurfaceKHR surface;OK(vkCreateWin32SurfaceKHR(instance,&sci,NULL,&surface));
 uint32_t n=16;VkPhysicalDevice gpus[16];OK(vkEnumeratePhysicalDevices(instance,&n,gpus));ASSERT(n);
 VkPhysicalDevice gpu=VK_NULL_HANDLE;uint32_t family=0;
 for(uint32_t g=0;g<n&&!gpu;g++){uint32_t nf=32;VkQueueFamilyProperties f[32];vkGetPhysicalDeviceQueueFamilyProperties(gpus[g],&nf,f);
  for(uint32_t q=0;q<nf;q++){VkBool32 support=0;vkGetPhysicalDeviceSurfaceSupportKHR(gpus[g],q,surface,&support);if(support&&(f[q].queueFlags&VK_QUEUE_GRAPHICS_BIT)){gpu=gpus[g];family=q;break;}}}ASSERT(gpu);
 float priority=1;VkDeviceQueueCreateInfo qi={.sType=VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO,.queueFamilyIndex=family,.queueCount=1,.pQueuePriorities=&priority};
 const char *deviceExtensions[]={"VK_KHR_swapchain"};
 VkDeviceCreateInfo dc={.sType=VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO,.queueCreateInfoCount=1,.pQueueCreateInfos=&qi,.enabledExtensionCount=1,.ppEnabledExtensionNames=deviceExtensions};
 VkDevice device;OK(vkCreateDevice(gpu,&dc,NULL,&device));
 PFN_vkGetDeviceProcAddr gdp=(PFN_vkGetDeviceProcAddr)gip(instance,"vkGetDeviceProcAddr");
 D(vkGetDeviceQueue);D(vkCreateSwapchainKHR);D(vkGetSwapchainImagesKHR);D(vkAcquireNextImageKHR);D(vkCreateSemaphore);D(vkCreateCommandPool);D(vkAllocateCommandBuffers);
 D(vkBeginCommandBuffer);D(vkEndCommandBuffer);D(vkResetCommandBuffer);D(vkFreeCommandBuffers);D(vkCmdPipelineBarrier);D(vkCmdClearColorImage);D(vkQueueSubmit);D(vkQueueWaitIdle);D(vkDeviceWaitIdle);
 D(vkCreateFence);D(vkDestroyFence);D(vkResetFences);
 D(vkCreateBuffer);D(vkGetBufferMemoryRequirements);D(vkAllocateMemory);D(vkBindBufferMemory);D(vkCmdCopyImageToBuffer);D(vkMapMemory);D(vkUnmapMemory);
 D(vkDestroyBuffer);D(vkFreeMemory);D(vkDestroySemaphore);D(vkDestroyCommandPool);D(vkDestroySwapchainKHR);D(vkDestroyDevice);
 VkQueue queue;vkGetDeviceQueue(device,family,0,&queue);
 VkSurfaceCapabilitiesKHR caps;OK(vkGetPhysicalDeviceSurfaceCapabilitiesKHR(gpu,surface,&caps));
 uint32_t formatsCount=32;VkSurfaceFormatKHR formats[32];OK(vkGetPhysicalDeviceSurfaceFormatsKHR(gpu,surface,&formatsCount,formats));
 VkSurfaceFormatKHR format=formats[0];for(uint32_t i=0;i<formatsCount;i++)if(formats[i].format==VK_FORMAT_B8G8R8A8_UNORM){format=formats[i];break;}
 VkExtent2D extent=caps.currentExtent;if(extent.width==UINT32_MAX)extent=(VkExtent2D){1280,720};
 VkImageUsageFlags usage=VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT|VK_IMAGE_USAGE_TRANSFER_SRC_BIT|VK_IMAGE_USAGE_TRANSFER_DST_BIT;ASSERT((caps.supportedUsageFlags&usage)==usage);
 uint32_t count=caps.minImageCount+1;if(caps.maxImageCount&&count>caps.maxImageCount)count=caps.maxImageCount;
 VkSwapchainCreateInfoKHR swapInfo={.sType=VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR,.surface=surface,.minImageCount=count,.imageFormat=format.format,.imageColorSpace=format.colorSpace,.imageExtent=extent,.imageArrayLayers=1,.imageUsage=usage,
  .imageSharingMode=VK_SHARING_MODE_EXCLUSIVE,.preTransform=caps.currentTransform,.compositeAlpha=VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR,.presentMode=VK_PRESENT_MODE_FIFO_KHR,.clipped=VK_TRUE};
 VkSwapchainKHR swap;OK(vkCreateSwapchainKHR(device,&swapInfo,NULL,&swap));count=16;VkImage images[16];OK(vkGetSwapchainImagesKHR(device,swap,&count,images));
 VkSemaphoreCreateInfo semInfo={.sType=VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO};VkSemaphore acquired;OK(vkCreateSemaphore(device,&semInfo,NULL,&acquired));uint32_t index;
 OK(vkAcquireNextImageKHR(device,swap,3000000000ULL,acquired,VK_NULL_HANDLE,&index));
 VkCommandPoolCreateInfo poolInfo={.sType=VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO,.flags=VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT,.queueFamilyIndex=family};VkCommandPool pool;OK(vkCreateCommandPool(device,&poolInfo,NULL,&pool));
 VkCommandBufferAllocateInfo ca={.sType=VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO,.commandPool=pool,.level=VK_COMMAND_BUFFER_LEVEL_PRIMARY,.commandBufferCount=2};VkCommandBuffer commands[2];OK(vkAllocateCommandBuffers(device,&ca,commands));
 VkCommandBufferBeginInfo bi={.sType=VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};
 // More than the layer's tracking capacity, but none present a game image.
 VkCommandBuffer unrelated[600];ca.commandBufferCount=600;OK(vkAllocateCommandBuffers(device,&ca,unrelated));
 for(int i=0;i<600;i++){OK(vkBeginCommandBuffer(unrelated[i],&bi));OK(vkEndCommandBuffer(unrelated[i]));}
 VkFenceCreateInfo fenceInfo={.sType=VK_STRUCTURE_TYPE_FENCE_CREATE_INFO};VkFence gameFence;OK(vkCreateFence(device,&fenceInfo,NULL,&gameFence));
 VkImageMemoryBarrier barrier;
 for(int frame=0;frame<24;frame++){
 OK(vkResetCommandBuffer(commands[0],0));OK(vkBeginCommandBuffer(commands[0],&bi));
 barrier=(VkImageMemoryBarrier){.sType=VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER,.oldLayout=VK_IMAGE_LAYOUT_UNDEFINED,.newLayout=VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,.dstAccessMask=VK_ACCESS_TRANSFER_WRITE_BIT,.srcQueueFamilyIndex=family,.dstQueueFamilyIndex=family,.image=images[index],.subresourceRange={VK_IMAGE_ASPECT_COLOR_BIT,0,1,0,1}};
 vkCmdPipelineBarrier(commands[0],VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT,VK_PIPELINE_STAGE_TRANSFER_BIT,0,0,NULL,0,NULL,1,&barrier);
 VkClearColorValue blue={.float32={.08f,.12f,.4f,1}};vkCmdClearColorImage(commands[0],images[index],VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,&blue,1,&barrier.subresourceRange);
 barrier.oldLayout=VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;barrier.newLayout=VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;barrier.srcAccessMask=VK_ACCESS_TRANSFER_WRITE_BIT;barrier.dstAccessMask=0;
 vkCmdPipelineBarrier(commands[0],VK_PIPELINE_STAGE_TRANSFER_BIT,VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT,0,0,NULL,0,NULL,1,&barrier);OK(vkEndCommandBuffer(commands[0]));
 VkPipelineStageFlags stage=VK_PIPELINE_STAGE_ALL_COMMANDS_BIT;VkSubmitInfo submit={.sType=VK_STRUCTURE_TYPE_SUBMIT_INFO,.waitSemaphoreCount=1,.pWaitSemaphores=&acquired,.pWaitDstStageMask=&stage,.commandBufferCount=1,.pCommandBuffers=&commands[0]};
 submit.waitSemaphoreCount=frame==0?1:0;
 if(frame%2)OK(vkResetFences(device,1,&gameFence));
 OK(vkQueueSubmit(queue,1,&submit,frame%2?gameFence:VK_NULL_HANDLE));OK(vkQueueWaitIdle(queue));
 }
 vkFreeCommandBuffers(device,pool,600,unrelated);
 VkDeviceSize bytes=(VkDeviceSize)extent.width*extent.height*4;
 VkBufferCreateInfo bufferInfo={.sType=VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO,.size=bytes,.usage=VK_BUFFER_USAGE_TRANSFER_DST_BIT};VkBuffer buffer;OK(vkCreateBuffer(device,&bufferInfo,NULL,&buffer));
 VkMemoryRequirements req;vkGetBufferMemoryRequirements(device,buffer,&req);VkPhysicalDeviceMemoryProperties memory;vkGetPhysicalDeviceMemoryProperties(gpu,&memory);uint32_t type=UINT32_MAX;
 for(uint32_t i=0;i<memory.memoryTypeCount;i++)if((req.memoryTypeBits&(1u<<i))&&(memory.memoryTypes[i].propertyFlags&(VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT|VK_MEMORY_PROPERTY_HOST_COHERENT_BIT))==(VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT|VK_MEMORY_PROPERTY_HOST_COHERENT_BIT)){type=i;break;}ASSERT(type!=UINT32_MAX);
 VkMemoryAllocateInfo ma={.sType=VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO,.allocationSize=req.size,.memoryTypeIndex=type};VkDeviceMemory allocation;OK(vkAllocateMemory(device,&ma,NULL,&allocation));OK(vkBindBufferMemory(device,buffer,allocation,0));
 OK(vkBeginCommandBuffer(commands[1],&bi));barrier.oldLayout=VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;barrier.newLayout=VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;barrier.srcAccessMask=VK_ACCESS_MEMORY_WRITE_BIT;barrier.dstAccessMask=VK_ACCESS_TRANSFER_READ_BIT;
 vkCmdPipelineBarrier(commands[1],VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,VK_PIPELINE_STAGE_TRANSFER_BIT,0,0,NULL,0,NULL,1,&barrier);
 VkBufferImageCopy region={.imageSubresource={VK_IMAGE_ASPECT_COLOR_BIT,0,0,1},.imageExtent={extent.width,extent.height,1}};vkCmdCopyImageToBuffer(commands[1],images[index],VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,buffer,1,&region);OK(vkEndCommandBuffer(commands[1]));
 VkSubmitInfo read={.sType=VK_STRUCTURE_TYPE_SUBMIT_INFO,.commandBufferCount=1,.pCommandBuffers=&commands[1]};OK(vkQueueSubmit(queue,1,&read,VK_NULL_HANDLE));OK(vkQueueWaitIdle(queue));
 unsigned char *pixels;OK(vkMapMemory(device,allocation,0,bytes,0,(void**)&pixels));size_t green=0,base=0;
 for(size_t i=0;i<bytes;i+=4){if(pixels[i+1]>80&&pixels[i+1]>pixels[i]*1.25&&pixels[i+1]>pixels[i+2]*1.25)green++;if(pixels[i]>70&&pixels[i+1]<70&&pixels[i+2]<70)base++;}
 printf("Native swapchain readback after 24 frames and 600 unrelated commands: %llu health pixels, %llu retained background pixels\n",(unsigned long long)green,(unsigned long long)base);
 ASSERT(green>100);ASSERT(base>(size_t)extent.width*extent.height/2);vkUnmapMemory(device,allocation);
 OK(vkDeviceWaitIdle(device));vkDestroyBuffer(device,buffer,NULL);vkFreeMemory(device,allocation,NULL);vkDestroySemaphore(device,acquired,NULL);vkDestroyCommandPool(device,pool,NULL);
 vkDestroyFence(device,gameFence,NULL);vkDestroySwapchainKHR(device,swap,NULL);vkDestroyDevice(device,NULL);vkDestroySurfaceKHR(instance,surface,NULL);vkDestroyInstance(instance,NULL);DestroyWindow(window);return 0;
}
