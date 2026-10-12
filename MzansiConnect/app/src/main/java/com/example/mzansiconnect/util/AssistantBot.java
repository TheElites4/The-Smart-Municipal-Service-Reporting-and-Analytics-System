package com.example.mzansiconnect.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Deterministic help responses selected by matching message keywords.
 */
public final class AssistantBot {

    private AssistantBot() {
    }

    private static class IntentPattern {
        final String intentName;
        final String[] keywords;
        final String response;

        IntentPattern(String intentName, String[] keywords, String response) {
            this.intentName = intentName;
            this.keywords = keywords;
            this.response = response;
        }
    }

        private static final List<IntentPattern> INTENTS = new ArrayList<>();

    static {
        // 1. Greetings (Multi-language: English, isiZulu, Afrikaans, Sesotho)
        INTENTS.add(new IntentPattern("greeting",
                new String[]{"hello", "hi", "hey", "sawubona", "molweni", "dumela", "dumelang", "khotso", "môre", "goeie dag", "greetings", "good morning", "good afternoon", "unjani"},
                "Sawubona! 👋 I'm the MzansiReport help assistant. I can help with reports, report status, live service availability, and emergency contacts. How can I help?"));

        // 2. Report submission
        INTENTS.add(new IntentPattern("report_issue",
                new String[]{"report", "submit", "new report", "log issue", "complain", "lodge", "pothole", "leak", "outage", "spill", "pipe", "dumping", "broken"},
                "To submit a municipal report:\n1. Tap 'New Report'.\n2. Choose a category and describe the issue.\n3. Add the location and municipality.\n4. Submit. The report appears in operations after the database confirms it."));

        // 3. Emergency Dispatch & SOS
        INTENTS.add(new IntentPattern("emergency",
                new String[]{"emergency", "sos", "police", "fire", "ambulance", "medical", "panic", "danger", "hazard", "10111", "10177", "112", "crime"},
                "🚨 EMERGENCY CONTACTS:\n• SAPS Police: 10111\n• Fire & Ambulance: 10177\n• National Emergency: 112 (Cellular)\n• Crime Stop: 08600 10111\nYou can also tap the red Emergency SOS button on any screen for direct dialing!"));

        // 4. Load Shedding & Power Status
        INTENTS.add(new IntentPattern("loadshedding",
                new String[]{"loadshedding", "load shedding", "power", "electricity", "stage", "eskom", "outage", "blackout", "substation", "cable theft", "tripped"},
                "Load-shedding status is shown when the live provider is available. For a local power issue, submit a report under 'Electricity'."));

        // 5. Water & Sanitation
        INTENTS.add(new IntentPattern("water_sanitation",
                new String[]{"water", "leak", "burst", "pipe", "sewage", "sewer", "no water", "cut off", "meter", "drain", "flood", "flooding", "dirty water"},
                "Report burst pipes, sewage leaks, or water outages using 'New Report'. Check the saved report details for its current status and due date."));

        // 6. Report Tracking & SLA Timeline
        INTENTS.add(new IntentPattern("track_report",
                new String[]{"track", "status", "progress", "reference", "my reports", "update", "ticket", "ref", "sla", "timeline"},
                "📊 Track Report Progress:\nGo to 'My Reports' on your dashboard. Tap any report to view its status (Submitted ➔ In Progress ➔ Resolved), assigned municipality unit, and live SLA countdown timer."));

        // 7. Municipality Contact Directory
        INTENTS.add(new IntentPattern("municipality_directory",
                new String[]{"municipality", "contact", "phone", "call", "office", "joburg", "tshwane", "ethekwini", "cape town", "ekurhuleni", "mangaung", "nelson mandela"},
                "For municipality office contacts, use the official website or contact centre for your municipality. Choose your municipality from the report form when submitting an issue."));

        // 8. Community Hero Gamification
        INTENTS.add(new IntentPattern("hero_points",
                new String[]{"points", "hero", "badge", "level", "reward", "gamification", "rank", "bronze", "silver", "gold", "platinum", "diamond"},
                "🏆 Community Hero Points:\n• Earn +10 Hero Points for every report submitted.\n• Earn +2 Hero Points for every 'Me Too' upvote given.\n• Level Up: Bronze (0 pts) ➔ Silver (50 pts) ➔ Gold (150 pts) ➔ Platinum (300 pts) ➔ Diamond (500+ pts)!"));

        // 9. Community Feed & Upvotes
        INTENTS.add(new IntentPattern("community_feed",
                new String[]{"community", "feed", "upvote", "me too", "neighbours", "nearby", "trending", "feed"},
                "👥 Community Feed & Upvoting:\nView issues reported in your neighborhood. Tap 'Me Too' on reports affecting your area to boost their community weight and help staff prioritize high-impact repairs!"));

        // 10. Billing, Rates & Taxes
        INTENTS.add(new IntentPattern("billing_rates",
                new String[]{"bill", "billing", "rates", "taxes", "account", "statement", "payment", "tariff", "meter reading"},
                "For billing, rates, or account questions, contact your municipality's official revenue department or website."));

        // 11. National Government Services (SASSA / Home Affairs)
        INTENTS.add(new IntentPattern("sassa_home_affairs",
                new String[]{"sassa", "home affairs", "id", "passport", "grant", "srd", "cert", "certificate", "birth"},
                "🇿🇦 National Government Services:\n• SASSA Grant Enquiries: 0800 60 10 11\n• Home Affairs Helpline: 0800 60 11 90\nCheck the Services tab in the app for step-by-step guides and online application portals!"));

        // 12. Thanks / Gratitude
        INTENTS.add(new IntentPattern("thanks",
                new String[]{"thank", "thanks", "dankie", "ngiyabonga", "ke a leboha", "bye", "goodbye"},
                "You're welcome! 🇿🇦 Together we're building cleaner, safer, and better South African communities. Feel free to ask me anything about MzansiReport anytime!"));
    }

    private static final String DEFAULT_RESPONSE =
            "I use built-in keyword matching to route common questions. You can ask me about:\n" +
            "• Submitting or tracking a report\n" +
            "• Emergency numbers & SOS\n" +
            "• Load shedding & water status\n" +
            "• Municipality contact directory\n" +
            "• Community Hero points & feed\n" +
            "• SASSA & Home Affairs services";

    /**
     * Responds to citizen queries with intent recognition, keyword scoring,
     * and multi-language fallback.
     */
    public static String respond(String input) {
        if (input == null || input.trim().isEmpty()) {
            return DEFAULT_RESPONSE;
        }

        String lower = input.toLowerCase(Locale.ENGLISH);
        IntentPattern bestPattern = null;
        int maxScore = 0;

        for (IntentPattern pattern : INTENTS) {
            int score = 0;
            for (String keyword : pattern.keywords) {
                if (lower.contains(keyword)) {
                    score += keyword.length() > 5 ? 2 : 1;
                }
            }
            if (score > maxScore) {
                maxScore = score;
                bestPattern = pattern;
            }
        }

        if (bestPattern != null && maxScore > 0) {
            return bestPattern.response;
        }

        return DEFAULT_RESPONSE;
    }
}
