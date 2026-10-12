package com.example.mzansiconnect.util;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Report categories, SLA targets, and local description classification helpers.
 */
public final class ServiceData {

    private ServiceData() {
    }

    /** Deterministic keyword rules used for local category suggestions. */
    public static final Map<String, String[]> CATEGORY_KEYWORDS = new LinkedHashMap<>();

    static {
        CATEGORY_KEYWORDS.put("Water & Sanitation",
                new String[]{"water", "leak", "pipe", "burst", "sewage", "sewer", "drain", "flood", "flooding", "meter", "tap", "no water", "pressure", "dirty water", "manhole", "spill", "wastewater", "hydrant"});
        CATEGORY_KEYWORDS.put("Electricity",
                new String[]{"power", "electricity", "outage", "cable", "cables", "spark", "sparks", "wire", "wires", "transformer", "loadshedding", "load shedding", "blackout", "substation", "trip", "tripped", "eskom", "voltage"});
        CATEGORY_KEYWORDS.put("Roads & Potholes",
                new String[]{"pothole", "potholes", "road", "roads", "asphalt", "traffic", "street", "pavement", "crater", "craters", "tar", "sinkhole", "crack", "bridge", "intersection", "speed hump", "curb", "lane"});
        CATEGORY_KEYWORDS.put("Street Lighting",
                new String[]{"light", "lights", "lamp", "lamp post", "streetlight", "streetlights", "dark", "darkness", "bulb", "illuminat", "pole", "flickering"});
        CATEGORY_KEYWORDS.put("Waste Management",
                new String[]{"garbage", "waste", "rubbish", "litter", "bin", "bins", "dumping", "dump", "refuse", "collection", "trash", "illegal dumping", "uncollected", "cleanliness", "recycling"});
        CATEGORY_KEYWORDS.put("Parks & Recreation",
                new String[]{"park", "parks", "playground", "grass", "tree", "trees", "garden", "green", "overgrown", "branch", "fallen tree", "stadium", "sports ground", "fencing"});
    }

    /** Suggests a category by scoring keyword matches in the description. */
    public static String suggestCategory(String description) {
        if (description == null || description.trim().isEmpty()) {
            return null;
        }
        String lower = description.toLowerCase();
        String bestCategory = null;
        int maxHits = 0;

        for (Map.Entry<String, String[]> entry : CATEGORY_KEYWORDS.entrySet()) {
            int hits = 0;
            for (String keyword : entry.getValue()) {
                if (lower.contains(keyword)) {
                    hits += keyword.length() > 5 ? 2 : 1;
                }
            }
            if (hits > maxHits) {
                maxHits = hits;
                bestCategory = entry.getKey();
            }
        }
        return bestCategory;
    }

    private static final String[] HIGH_URGENCY_KEYWORDS = {
        "burst", "live wire", "spark", "sparking", "fire", "flood", "flooding", "sinkhole", "sewage overflow",
        "blocking road", "danger", "hazard", "explosion", "blackout", "no water"
    };

    /** Suggests urgency using explicit risk keywords and description length. */
    public static String detectUrgency(String description) {
        if (description == null) return "medium";
        String lower = description.toLowerCase();
        for (String trigger : HIGH_URGENCY_KEYWORDS) {
            if (lower.contains(trigger)) {
                return "high";
            }
        }
        if (lower.length() < 30) {
            return "low";
        }
        return "medium";
    }

}
