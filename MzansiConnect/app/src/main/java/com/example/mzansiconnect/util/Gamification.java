package com.example.mzansiconnect.util;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Mirrors Citizen Portal Mobile App `src/app/utils/gamification.ts`. Hero
 * points: +10 per report, +2 per "Me Too" upvote. Levels: Bronze(0) ->
 * Silver(100) -> Gold(250) -> Platinum(500) -> Diamond(1000).
 */
public final class Gamification {

    public static final int POINTS_PER_REPORT = 10;
    public static final int POINTS_PER_UPVOTE = 2;

    private static final String STORAGE_KEY = "heroPoints";
    private static final String KEY_POINTS = "points";
    private static final String KEY_REPORTS = "reportsSubmitted";
    private static final String KEY_UPVOTES = "upvotesGiven";

    private Gamification() {
    }

    /**
     * Immutable snapshot of the citizen's hero profile.
     */
    public static final class HeroProfile {

        public final int points;
        public final int reportsSubmitted;
        public final int upvotesGiven;

        public HeroProfile(int points, int reportsSubmitted, int upvotesGiven) {
            this.points = points;
            this.reportsSubmitted = reportsSubmitted;
            this.upvotesGiven = upvotesGiven;
        }
    }

    /**
     * Resolved hero level + label + points remaining to the next level.
     */
    public static final class HeroLevel {

        public final String level;      // bronze|silver|gold|platinum|diamond
        public final String labelKey;   // levelBronze...levelDiamond
        public final int next;          // -1 when at max level (diamond)

        public HeroLevel(String level, String labelKey, int next) {
            this.level = level;
            this.labelKey = labelKey;
            this.next = next;
        }

        public boolean isMaxLevel() {
            return next < 0;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext()
                .getSharedPreferences(STORAGE_KEY, Context.MODE_PRIVATE);
    }

    public static HeroProfile getHeroProfile(Context context) {
        SharedPreferences p = prefs(context);
        return new HeroProfile(
                p.getInt(KEY_POINTS, 0),
                p.getInt(KEY_REPORTS, 0),
                p.getInt(KEY_UPVOTES, 0));
    }

    public static HeroProfile awardReportPoints(Context context) {
        return award(context, POINTS_PER_REPORT, 1, 0);
    }

    public static HeroProfile awardUpvotePoints(Context context) {
        return award(context, POINTS_PER_UPVOTE, 0, 1);
    }

    private static HeroProfile award(Context context, int points, int reports, int upvotes) {
        HeroProfile current = getHeroProfile(context);
        HeroProfile next = new HeroProfile(
                current.points + points,
                current.reportsSubmitted + reports,
                current.upvotesGiven + upvotes);
        prefs(context).edit()
                .putInt(KEY_POINTS, next.points)
                .putInt(KEY_REPORTS, next.reportsSubmitted)
                .putInt(KEY_UPVOTES, next.upvotesGiven)
                .apply();
        return next;
    }

    public static HeroLevel getHeroLevel(int points) {
        if (points >= 1000) {
            return new HeroLevel("diamond", "levelDiamond", -1);
        } else if (points >= 500) {
            return new HeroLevel("platinum", "levelPlatinum", 1000 - points);
        } else if (points >= 250) {
            return new HeroLevel("gold", "levelGold", 500 - points);
        } else if (points >= 100) {
            return new HeroLevel("silver", "levelSilver", 250 - points);
        }
        return new HeroLevel("bronze", "levelBronze", 100 - points);
    }
}
