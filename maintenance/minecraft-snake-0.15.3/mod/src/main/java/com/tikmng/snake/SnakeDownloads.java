package com.tikmng.snake;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Arrays;
import net.minecraft.Util;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.toasts.SystemToast;
import net.minecraft.network.chat.Component;

/** Exports the supplied guide without replacing an existing different file. */
public final class SnakeDownloads {
    private SnakeDownloads(){}
    public static void saveGiftImage(){
        var mc=Minecraft.getInstance();
        try(InputStream in=SnakeDownloads.class.getResourceAsStream("/assets/tikmng_snake_arena/snake-gift-guide.png")){
            if(in==null)throw new IOException("Hediye gorseli bulunamadi");
            Path target=export(Path.of(System.getProperty("user.home"),"Downloads"),in.readAllBytes());
            Util.getPlatform().openFile(target.getParent().toFile());
            SystemToast.add(mc.getToasts(),SystemToast.SystemToastIds.WORLD_BACKUP,
                Component.literal("Hediye gorseli indirildi"),Component.literal(target.getFileName().toString()));
        }catch(IOException|RuntimeException ex){
            SystemToast.add(mc.getToasts(),SystemToast.SystemToastIds.PACK_COPY_FAILURE,
                Component.literal("Gorsel kaydedilemedi"),Component.literal("Indirilenler klasorunun yazma iznini kontrol et."));
        }
    }
    static Path export(Path directory,byte[] bytes)throws IOException{
        Files.createDirectories(directory);
        String base="TikMNG-Minecraft-Yilan-Hediyeleri";
        for(int i=0;i<1000;i++){
            Path target=directory.resolve(base+(i==0?"":"-"+i)+".png");
            if(Files.exists(target)){
                if(Files.size(target)==bytes.length&&Arrays.equals(Files.readAllBytes(target),bytes))return target;
                continue;
            }
            try{Files.write(target,bytes,StandardOpenOption.CREATE_NEW);return target;}
            catch(FileAlreadyExistsException ex){/* Another export won this name; try the next one. */}
        }
        throw new IOException("Dosya adi sinirina ulasildi");
    }
}
