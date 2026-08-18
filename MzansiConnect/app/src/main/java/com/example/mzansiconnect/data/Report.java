package com.example.mzansiconnect.data;

import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "reports")
public class Report {
    @PrimaryKey(autoGenerate = true)
    public int id;
    public int userId;
    public String category;
    public String description;
    public String location;
    public String municipality;
    public String urgency;
    public String status; // "Submitted", "Review", "In-Progress", "Resolved"
    public long timestamp;
    public int upvotes;
    public boolean isSafetyAlert;
}