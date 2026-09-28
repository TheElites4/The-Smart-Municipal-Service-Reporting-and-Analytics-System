package com.example.mzansiconnect.data;

import androidx.room.Entity;
import androidx.room.PrimaryKey;

/**
 * Mirrors the web citizen report shape (see Citizen Portal `App.tsx` / `ReportForm.tsx`).
 * `publicReference` is the human id shown in the UI (e.g. RPT-1712345678901).
 */
@Entity(tableName = "reports")
public class Report {
    @PrimaryKey(autoGenerate = true)
    public int id;
    public int userId;
    public String category;
    public String description;
    public String location;
    public String municipality;
    public String urgency;      // "low" | "medium" | "high"
    public String status;       // "submitted" | "in-progress" | "resolved"
    public long timestamp;
    public int upvotes;
    public boolean isSafetyAlert;

    /** Human readable reference (web report.id, e.g. "RPT-1712345678901"). */
    public String publicReference;
    /** Server-side database id used for the tracking timeline endpoint. */
    public String remoteId;
    /** Hero points awarded for this report. */
    public int points;
    /** Category suggested by the description keyword scan (nullable). */
    public String aiDetectedCategory;
}