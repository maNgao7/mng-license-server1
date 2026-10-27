package com.tikmng.snowwar;

import com.tikmng.snowwar.client.SnowWarFollowCameraRegression;
import com.tikmng.snowwar.game.SnowWarState;

public final class SnowWarRegressionSuite {
    public static void main(String[] args) {
        for (int joins : new int[] {0, 1, 4, 5, 300}) waitingNeverStarts(joins);
        countdownAndPause();
        pToggle();
        realContestRequired();
        nextRoundWaits();
        SnowWarFollowCameraRegression.run();
        System.out.println("SNOWWAR regression checks passed: waiting 0/1/4/5/300, P countdown, pause, contest, reset, ray selection and camera cleanup");
    }

    private static void waitingNeverStarts(int joins) {
        SnowWarState state = new SnowWarState();
        join(state, joins);
        for (int tick = 0; tick < 1200; tick++) {
            state.tickStartCountdown();
            check(!state.running(), joins + " joins must wait for P");
            check(state.startCountdownSeconds() == 0, "joins must not open a countdown");
            check(!state.observeTeams(joins), "waiting must never declare a winner");
        }
    }

    private static void countdownAndPause() {
        SnowWarState state = new SnowWarState();
        check(state.start(), "P starts the countdown");
        check(state.startCountdownSeconds() == 10 && !state.running(), "P must show 10 before combat");
        for (int tick = 1; tick < 200; tick++) {
            check(!state.start(), "repeated P during countdown is a no-op");
            state.tickStartCountdown();
            check(!state.running(), "combat must wait the entire 200 ticks");
            check(state.startCountdownSeconds() == (200 - tick + 19) / 20, "countdown second");
            check(!state.observeTeams(2), "countdown cannot qualify as a contest");
        }
        state.stop();
        for (int i = 0; i < 500; i++) state.tickStartCountdown();
        check(state.paused() && !state.running() && state.startCountdownSeconds() == 1, "paused start timer freezes");
        check(state.start(), "P resumes a paused countdown");
        state.tickStartCountdown();
        check(state.running() && state.startCountdownSeconds() == 0, "combat starts at 200 active ticks");
        check(!state.start(), "P during combat is a no-op");
        state.observeTeams(2);
        state.stop();
        check(!state.observeTeams(1), "paused combat cannot award a winner");
        check(state.start() && state.running(), "P resumes paused combat");
        check(state.observeTeams(1), "pause preserves this round's contest");
    }

    private static void realContestRequired() {
        SnowWarState state = new SnowWarState();
        join(state, 1);
        state.observeTeams(2);
        state.start();
        for (int i = 0; i < 200; i++) state.tickStartCountdown();
        for (int i = 0; i < 1200; i++) check(!state.observeTeams(1), "a lone starter must not win");
        check(!state.observeTeams(2), "two rival teams qualify combat but cannot win yet");
        check(state.observeTeams(1), "last team after a real contest can open the winner timer");
        check(!state.observeTeams(2), "new rival cancels a sole-team candidate");
        check(!state.observeTeams(0), "an empty arena cannot win");
    }

    private static void pToggle() {
        SnowWarState state = new SnowWarState();
        state.toggle();
        check(state.startCountdownSeconds() == 10, "first P begins a fresh 10-second preparation");
        for (int i = 0; i < 50; i++) state.tickStartCountdown();
        state.toggle();
        int frozen = state.startCountdownSeconds();
        for (int i = 0; i < 1000; i++) state.tickStartCountdown();
        check(state.paused() && !state.running() && state.startCountdownSeconds() == frozen,
            "second P freezes preparation");
        state.toggle();
        for (int i = 0; i < 150; i++) state.tickStartCountdown();
        check(state.running(), "third P resumes the same preparation, not another 10 seconds");
        state.observeTeams(2);
        for (int i = 0; i < 100; i++) {
            state.toggle();
            check(state.paused() && !state.running() && !state.observeTeams(1), "P pauses a contested battle");
            state.toggle();
            check(state.running() && state.observeTeams(1), "P resumes without losing the last-team state");
        }
        state.reset();
        check(!state.started() && !state.paused(), "winner resets back to manual waiting");
        join(state, 5);
        for (int i = 0; i < 1000; i++) state.tickStartCountdown();
        check(!state.started(), "new viewers after a win cannot restart battle");
        state.toggle();
        check(state.startCountdownSeconds() == 10 && !state.running(), "next round needs P and full preparation");
    }

    private static void nextRoundWaits() {
        SnowWarState state = new SnowWarState();
        for (int joins : new int[] {1, 4, 5, 300}) {
            state.reset();
            join(state, joins);
            for (int i = 0; i < 1000; i++) state.tickStartCountdown();
            check(!state.running() && state.startCountdownSeconds() == 0, "new joins after reset must wait for P");
            state.start();
            for (int i = 0; i < 199; i++) state.tickStartCountdown();
            check(!state.running(), "every new round requires the full countdown");
            state.tickStartCountdown();
            check(state.running() && !state.observeTeams(1), "reset clears the prior contest");
            state.observeTeams(2);
            check(state.observeTeams(1), "new contested round can finish");
        }
        state.reset();
        check(state.fighters().isEmpty(), "round reset clears combat roster");
    }

    private static void join(SnowWarState state, int count) {
        for (int i = 0; i < count; i++) state.fighter("viewer-" + i, "Viewer" + i, "");
    }

    public static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
}
