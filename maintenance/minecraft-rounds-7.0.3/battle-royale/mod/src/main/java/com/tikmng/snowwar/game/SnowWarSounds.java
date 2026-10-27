package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.sounds.SoundEvent;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class SnowWarSounds {
    public static final DeferredRegister<SoundEvent> REGISTER = DeferredRegister.create(ForgeRegistries.SOUND_EVENTS, SnowWar.MOD_ID);
    public static final RegistryObject<SoundEvent> CHRISTMAS = REGISTER.register("christmas", () ->
        SoundEvent.createVariableRangeEvent(ResourceLocation.fromNamespaceAndPath(SnowWar.MOD_ID, "christmas")));
    public static final RegistryObject<SoundEvent> WIND = REGISTER.register("wind", () ->
        SoundEvent.createVariableRangeEvent(ResourceLocation.fromNamespaceAndPath(SnowWar.MOD_ID, "wind")));
    public static final RegistryObject<SoundEvent> LOBBY_MUSIC = REGISTER.register("lobby_music", () ->
        SoundEvent.createVariableRangeEvent(ResourceLocation.fromNamespaceAndPath(SnowWar.MOD_ID, "lobby_music")));
    public static final RegistryObject<SoundEvent> WINNER = REGISTER.register("winner", () ->
        SoundEvent.createVariableRangeEvent(ResourceLocation.fromNamespaceAndPath(SnowWar.MOD_ID, "winner")));
    private SnowWarSounds() {}
}
