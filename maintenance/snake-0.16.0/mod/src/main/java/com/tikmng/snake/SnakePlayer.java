package com.tikmng.snake;

import net.minecraft.client.Minecraft;
import org.lwjgl.glfw.GLFW;

/** Broadcaster input is separate from the native spectator camera. */
public final class SnakePlayer {
    private static String id="";
    private static boolean qaInput;
    private static double qaForward,qaStrafe;
    private SnakePlayer(){}
    public static boolean keyPressed(int key){
        if(!SnakeClient.active||!gameView())return false;
        if(key==GLFW.GLFW_KEY_O){SnakeClient.ENGINE.requestBattle();return true;}
        if(key!=GLFW.GLFW_KEY_TAB)return false;
        join();return true;
    }
    public static String id(){return SnakeClient.ENGINE.controlledId();}
    public static boolean joined(){return !id().isEmpty()&&SnakeClient.ENGINE.snakes.containsKey(id());}
    public static boolean controlling(){return joined()&&!SnakeCamera.free;}
    public static boolean watchingSelf(){
        var watched=SnakeCamera.followed();
        return controlling()&&SnakeCamera.following()&&watched!=null&&watched.id.equals(id());
    }
    private static boolean gameView(){var screen=Minecraft.getInstance().screen;return screen==null||screen instanceof SnakeScreens.Arena;}
    /** Call once per native right-button PRESS; holding the button never adds mass. */
    public static boolean rightClick(){
        var mc=Minecraft.getInstance();var window=mc.getWindow();
        return rightClick(mc.mouseHandler.xpos()*window.getGuiScaledWidth()/Math.max(1,window.getScreenWidth()),
            mc.mouseHandler.ypos()*window.getGuiScaledHeight()/Math.max(1,window.getScreenHeight()));
    }
    static boolean rightClick(double x,double y){
        if(!SnakeClient.active||!gameView()||!watchingSelf())return false;
        if(Minecraft.getInstance().screen instanceof SnakeScreens.Arena arena&&!arena.gameViewAt(x,y))return false;
        var snake=SnakeClient.ENGINE.snakes.get(id());
        SnakeCamera.rightZoom(false);
        SnakeClient.ENGINE.feed(snake.id,snake.name,snake.profile,10,0);return true;
    }
    public static void join(){
        if(!SnakeClient.active)return;
        String account=SnakeClient.CONFIG.username.trim().replaceFirst("^@","");
        id=account.isEmpty()?"local-publisher":account;
        var old=SnakeClient.ENGINE.snakes.get(id);String profile=old==null?"":old.profile;
        var player=SnakeClient.ENGINE.joinPublisher(id,account.isEmpty()?"Yayinci":account,profile);
        if(player==null)return;
        Minecraft.getInstance().options.keyJump.setDown(false);SnakeCamera.watch(player.id);
    }
    public static boolean grow(double amount){
        if(!Double.isFinite(amount)||amount<1||amount>1000000)return false;
        if(!joined())join();var snake=SnakeClient.ENGINE.snakes.get(id());if(snake==null)return false;
        SnakeClient.ENGINE.feed(snake.id,snake.name,snake.profile,amount,0);return true;
    }
    public static void tick(){
        var mc=Minecraft.getInstance();var engine=SnakeClient.ENGINE;
        boolean game=gameView();
        if(!controlling()||!game||(!qaInput&&!mc.isWindowActive())){engine.publisherDirection(0,0);return;}
        long window=mc.getWindow().getWindow();
        double forward=qaInput?qaForward:(down(window,GLFW.GLFW_KEY_W)?1:0)-(down(window,GLFW.GLFW_KEY_S)?1:0);
        double strafe=qaInput?qaStrafe:(down(window,GLFW.GLFW_KEY_D)?1:0)-(down(window,GLFW.GLFW_KEY_A)?1:0);
        double yaw=Math.toRadians(mc.gameRenderer.getMainCamera().getYRot());
        engine.publisherDirection(-Math.sin(yaw)*forward-Math.cos(yaw)*strafe,Math.cos(yaw)*forward-Math.sin(yaw)*strafe);
    }
    private static boolean down(long window,int key){return GLFW.glfwGetKey(window,key)==GLFW.GLFW_PRESS;}
    static void qaInput(double forward,double strafe){
        if(!Boolean.getBoolean("tikmng.snake.smoke"))throw new IllegalStateException("QA input requires isolated smoke mode");
        qaInput=true;qaForward=forward;qaStrafe=strafe;
    }
    static void clearQaInput(){qaInput=false;qaForward=qaStrafe=0;}
}
