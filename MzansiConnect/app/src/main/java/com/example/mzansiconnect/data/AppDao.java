package com.example.mzansiconnect.data;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.Query;
import java.util.List;

@Dao
public interface AppDao {
    @Insert
    void registerUser(User user);

    @Query("SELECT * FROM users WHERE idNumber = :idNumber AND password = :password LIMIT 1")
    User login(String idNumber, String password);

    @Insert
    void submitReport(Report report);

    @Query("SELECT * FROM reports WHERE userId = :userId ORDER BY timestamp DESC")
    List<Report> getUserReports(int userId);

    @Query("SELECT * FROM reports ORDER BY timestamp DESC")
    List<Report> getAllReports();

    @Query("SELECT COUNT(*) FROM reports WHERE userId = :userId")
    int getTotalReports(int userId);

    @Query("SELECT COUNT(*) FROM reports WHERE userId = :userId AND status = 'resolved'")
    int getResolvedReports(int userId);

    @Query("SELECT COUNT(*) FROM reports WHERE userId = :userId AND status = 'in-progress'")
    int getInProgressReports(int userId);

    @Query("UPDATE reports SET upvotes = upvotes + 1 WHERE id = :reportId")
    void upvoteReport(int reportId);

    @Query("SELECT * FROM reports ORDER BY upvotes DESC, timestamp DESC LIMIT 5")
    List<Report> getTrendingReports();
}