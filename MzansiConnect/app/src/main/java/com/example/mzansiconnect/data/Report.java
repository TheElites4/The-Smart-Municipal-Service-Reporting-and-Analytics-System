package com.example.mzansiconnect.data;

import androidx.room.Entity;
import androidx.room.PrimaryKey;

/**
 * Mirrors the web citizen report shape (see Citizen Portal `App.tsx` / `ReportForm.tsx`).
 * `publicReference` and `remoteId` are returned by the shared API.
 */
@Entity(tableName = "reports")
public class Report {
    @PrimaryKey(autoGenerate = true)
    public int id;
    public String category;
    public String description;
    public String location;
    public String municipality;
    public Double latitude;
    public Double longitude;
    public boolean hasPhoto;
    public String urgency;      // "low" | "medium" | "high"
    public String status;       // "submitted" | "in-progress" | "resolved"
    public long timestamp;
    public long slaDueAt;
    public int upvotes;
    /** Human-readable database report reference. */
    public String publicReference;
    /** Server-side database id used for the tracking timeline endpoint. */
    public String remoteId;
    /** Hero points awarded for this report. */
    public int points;
}