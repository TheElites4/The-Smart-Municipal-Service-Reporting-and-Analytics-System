package com.example.mzansiconnect.data;

import com.example.mzansiconnect.BuildConfig;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;
import retrofit2.http.Body;
import retrofit2.http.POST;

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

        @POST("api/mobile/reports")
        Call<Map<String, Object>> submitReport(@Body Map<String, Object> payload);
    }
}
