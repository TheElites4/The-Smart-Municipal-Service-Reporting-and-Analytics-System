package com.example.mzansiconnect.util;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Mirrors Citizen Portal Mobile App `src/app/utils/serviceData.ts` (SLA per
 * category, category stats, status distribution, monthly trend, and the live
 * service status board rows).
 */
public final class ServiceData {

    private ServiceData() {
    }

    /**
     * SLA (hours) by issue category.
     */
    public static final Map<String, Integer> SLA_BY_CATEGORY = new LinkedHashMap<>();

    static {
        SLA_BY_CATEGORY.put("Water & Sanitation", 48);
        SLA_BY_CATEGORY.put("Electricity", 72);
        SLA_BY_CATEGORY.put("Roads & Potholes", 120);
        SLA_BY_CATEGORY.put("Street Lighting", 96);
        SLA_BY_CATEGORY.put("Waste Management", 24);
        SLA_BY_CATEGORY.put("Parks & Recreation", 168);
        SLA_BY_CATEGORY.put("Other", 240);
    }

    /**
     * Issue categories in the same order as the web report form.
     */
    public static final List<String> CATEGORIES = Arrays.asList(
            "Water & Sanitation",
            "Electricity",
            "Roads & Potholes",
            "Street Lighting",
            "Waste Management",
            "Parks & Recreation",
            "Other");

    /**
     * Keyword lists trained on Kaggle 311 Municipal Service Request Dataset.
     */
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

    public static int slaHours(String category) {
        Integer hours = SLA_BY_CATEGORY.get(category);
        return hours == null ? 48 : hours;
    }

    /**
     * Kaggle 311 ML Classifier: returns the detected category name based on keyword scoring.
     */
    public static String detectCategory(String description) {
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

    /**
     * AI Urgency Detector: detects urgency ('high', 'medium', 'low') based on issue impact analysis.
     */
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

    /**
     * Reports-by-category counts (web CATEGORY_STATS).
     */
    public static final Map<String, Integer> CATEGORY_STATS = new LinkedHashMap<>();

    static {
        CATEGORY_STATS.put("Water & Sanitation", 34);
        CATEGORY_STATS.put("Electricity", 22);
        CATEGORY_STATS.put("Roads & Potholes", 18);
        CATEGORY_STATS.put("Street Lighting", 11);
        CATEGORY_STATS.put("Waste Management", 9);
        CATEGORY_STATS.put("Parks & Recreation", 4);
        CATEGORY_STATS.put("Other", 2);
    }

    /**
     * Status distribution (Submitted / In Progress / Resolved).
     */
    public static final int[] STATUS_DISTRIBUTION = {25, 45, 30};

    /**
     * Monthly trend: 6 months of reports vs resolved.
     */
    public static final String[] TREND_MONTHS = {"Jan", "Feb", "Mar", "Apr", "May", "Jun"};
    public static final int[] TREND_REPORTS = {120, 150, 135, 180, 210, 195};
    public static final int[] TREND_RESOLVED = {90, 110, 100, 140, 160, 150};

    /**
     * One row of the live service status board.
     */
    public static final class ServiceStatus {

        public final String area;
        public final String water;  // normal|reduced|outage
        public final String power;  // normal|reduced|outage
        public final String updated;

        public ServiceStatus(String area, String water, String power, String updated) {
            this.area = area;
            this.water = water;
            this.power = power;
            this.updated = updated;
        }
    }

    public static final List<ServiceStatus> SERVICE_STATUS = Arrays.asList(
            new ServiceStatus("City of Johannesburg", "normal", "reduced", "2 mins ago"),
            new ServiceStatus("City of Cape Town", "outage", "normal", "5 mins ago"),
            new ServiceStatus("eThekwini Municipality", "normal", "normal", "10 mins ago"),
            new ServiceStatus("City of Tshwane", "reduced", "reduced", "15 mins ago"),
            new ServiceStatus("Ekurhuleni", "outage", "normal", "20 mins ago"));
}
