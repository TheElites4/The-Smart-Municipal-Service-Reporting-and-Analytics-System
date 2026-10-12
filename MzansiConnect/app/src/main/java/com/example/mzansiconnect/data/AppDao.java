package com.example.mzansiconnect.data;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.Query;
import java.util.List;

@Dao
public interface AppDao {
    @Insert
    void registerUser(User user);

    @Insert
    void submitReport(Report report);

    @Query("DELETE FROM reports")
    void clearReports();

    @Query("SELECT * FROM reports ORDER BY timestamp DESC")
    List<Report> getAllReports();

    @Query("UPDATE reports SET upvotes = upvotes + 1 WHERE id = :reportId")
    void upvoteReport(int reportId);

    /** Stores the server-side id returned by the shared API so the tracking timeline
     *  endpoint can be queried by the real database id rather than the local
     *  public reference, which the API does not know about. */
    @Query("UPDATE reports SET remoteId = :remoteId WHERE id = :reportId")
    void setRemoteId(int reportId, String remoteId);

    @Query("SELECT * FROM reports ORDER BY upvotes DESC, timestamp DESC LIMIT 5")
    List<Report> getTrendingReports();
}