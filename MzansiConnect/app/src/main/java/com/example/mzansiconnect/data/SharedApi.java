package com.example.mzansiconnect.data;

import com.example.mzansiconnect.BuildConfig;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;
import java.util.List;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;

public final class SharedApi {
    private static final ApiService SERVICE = new Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService.class);

    private SharedApi() { }

    public static ApiService service() {
        return SERVICE;
    }

    public interface ApiService {
        @POST("api/users/citizen")
        Call<Map<String, Object>> registerCitizen(@Body Map<String, Object> payload);

        /** Web `POST /api/users/anonymous` - resolves/creates a citizen identity. */
        @POST("api/users/anonymous")
        Call<Map<String, Object>> resolveAnonymous(@Body Map<String, Object> payload);

        @POST("api/mobile/reports")
        Call<Map<String, Object>> submitReport(@Body Map<String, Object> payload);

        /** Web `POST /api/reports` - canonical citizen report creation. */
        @POST("api/reports")
        Call<Map<String, Object>> createReport(@Body Map<String, Object> payload);

        /** Web `GET /api/reports?citizenId=` - reports for one citizen. */
        @GET("api/reports")
        Call<List<Map<String, Object>>> getReports(@Query("citizenId") String citizenId);

        /** Web `GET /api/reports/:id/events` - tracking timeline. */
        @GET("api/reports/{id}/events")
        Call<List<Map<String, Object>>> getReportEvents(@Path("id") String reportId);

        /** Web `GET /api/leaderboard` - community hero leaderboard. */
        @GET("api/leaderboard")
        Call<List<Map<String, Object>>> getLeaderboard();

        /** Web `GET /api/location/status` - load-shedding / area status. */
        @GET("api/location/status")
        Call<Map<String, Object>> getLocationStatus(@Query("latitude") String latitude,
                                                    @Query("longitude") String longitude,
                                                    @Query("municipality") String municipality);

        /** Web `GET /api/loadshedding/schedules` - Eskom live load shedding schedules dataset. */
        @GET("api/loadshedding/schedules")
        Call<Map<String, Object>> getLoadSheddingSchedules();
    }
}
