package com.example.mzansiconnect.ui.report;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.contract.ActivityResultContracts;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.DataRepository;
import com.example.mzansiconnect.data.Report;
import com.example.mzansiconnect.data.SharedApi;
import com.example.mzansiconnect.util.Gamification;
import com.example.mzansiconnect.util.ServiceData;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Mirrors the citizen report form with API-provided category tiles, dropdown
 * choices, keyword suggestions, GPS location, urgency selection, and validation.
 */
public class ReportSubmissionFragment extends Fragment {

    private FusedLocationProviderClient fusedLocationClient;
    private EditText locationEdit, descEdit;
    private AutoCompleteTextView municipalityEdit, issueEdit;
    private GridLayout categoryGrid;
    private final List<String> categoryOptions = new ArrayList<>();
    private final Map<String, List<String>> issueOptions = new HashMap<>();
    private Map<String, Object> selectedPhoto;
    private Double latitude, longitude;
    private final androidx.activity.result.ActivityResultLauncher<String> photoPicker = registerForActivityResult(new ActivityResultContracts.GetContent(), this::readPhoto);
    private TextView municipalityDetected, suggestionStatus, descriptionError, locationError,
            categoryError, descriptionCount;

    private Button urgencyLow, urgencyMedium, urgencyHigh;
    private String selectedCategory = null;
    private String selectedUrgency = "medium";
    private final List<String> municipalityOptions = new ArrayList<>();
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_report_submission, container, false);

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity());
        locationEdit = root.findViewById(R.id.edit_location);
        descEdit = root.findViewById(R.id.edit_desc);
        categoryGrid = root.findViewById(R.id.category_grid);
        municipalityEdit = root.findViewById(R.id.edit_municipality);
        issueEdit = root.findViewById(R.id.edit_issue_type);
        root.findViewById(R.id.btn_photo).setOnClickListener(v -> photoPicker.launch("image/*"));
        municipalityDetected = root.findViewById(R.id.tv_municipality_detected);
        suggestionStatus = root.findViewById(R.id.category_suggestion_status);
        descriptionError = root.findViewById(R.id.description_error);
        locationError = root.findViewById(R.id.location_error);
        categoryError = root.findViewById(R.id.category_error);
        descriptionCount = root.findViewById(R.id.description_count);
        urgencyLow = root.findViewById(R.id.btn_urgency_low);
        urgencyMedium = root.findViewById(R.id.btn_urgency_medium);
        urgencyHigh = root.findViewById(R.id.btn_urgency_high);
        ImageButton gpsBtn = root.findViewById(R.id.btn_gps);
        Button submitBtn = root.findViewById(R.id.btn_submit_report);
        Button cancelBtn = root.findViewById(R.id.btn_cancel_report);
        View suggestCategory = root.findViewById(R.id.btn_suggest_category);

        categoryOptions.addAll(ServiceData.CATEGORY_KEYWORDS.keySet());
        categoryOptions.add("Other");
        populateCategoryGrid();
        loadReportOptions();
        municipalityEdit.setOnItemClickListener((parent, view, position, id) -> municipalityEdit.setError(null));
        municipalityEdit.setOnClickListener(v -> municipalityEdit.showDropDown());
        issueEdit.setOnClickListener(v -> issueEdit.showDropDown());

        descEdit.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void afterTextChanged(android.text.Editable s) {
                descriptionCount.setText(getString(R.string.wc_character_count_placeholder, s.length()));
                if (suggestionStatus.getVisibility() == View.VISIBLE) suggestionStatus.setVisibility(View.GONE);
            }
        });

        suggestCategory.setOnClickListener(v -> showCategorySuggestion());
        gpsBtn.setOnClickListener(v -> getGPSLocation());

        urgencyLow.setOnClickListener(v -> setUrgency("low"));
        urgencyMedium.setOnClickListener(v -> setUrgency("medium"));
        urgencyHigh.setOnClickListener(v -> setUrgency("high"));
        setUrgency("medium");

        cancelBtn.setOnClickListener(v -> Navigation.findNavController(root).navigateUp());
        submitBtn.setOnClickListener(v -> submitReport(root));

        return root;
    }

    /* ---------- API-provided dropdown options ---------- */

    private void loadReportOptions() {
        SharedApi.service().getOptions().enqueue(new retrofit2.Callback<java.util.Map<String, Object>>() {
            @Override
            public void onResponse(retrofit2.Call<java.util.Map<String, Object>> call,
                                   retrofit2.Response<java.util.Map<String, Object>> response) {
                if (!isAdded() || !response.isSuccessful() || response.body() == null) {
                    if (isAdded()) Toast.makeText(requireContext(), "Report choices are unavailable. Check the service connection.", Toast.LENGTH_LONG).show();
                    return;
                }
                List<String> categories = stringList(response.body().get("categories"));
                if (!categories.isEmpty()) {
                    categoryOptions.clear();
                    categoryOptions.addAll(categories);
                    if (!categoryOptions.contains("Other")) categoryOptions.add("Other");
                }
                populateCategoryGrid();
                issueOptions.clear();
                Object issues = response.body().get("issues");
                if (issues instanceof List<?>) for (Object entry : (List<?>) issues) {
                    if (entry instanceof Map<?, ?>) {
                        Map<?, ?> item = (Map<?, ?>) entry;
                        issueOptions.computeIfAbsent(String.valueOf(item.get("category")), key -> new ArrayList<>()).add(String.valueOf(item.get("label")));
                    }
                }
                municipalityOptions.clear();
                municipalityOptions.addAll(stringList(response.body().get("municipalities")));
                municipalityEdit.setAdapter(new ArrayAdapter<>(requireContext(), android.R.layout.simple_dropdown_item_1line, municipalityOptions));
            }

            @Override
            public void onFailure(retrofit2.Call<java.util.Map<String, Object>> call, Throwable throwable) {
                if (isAdded()) {
                    populateCategoryGrid();
                    Toast.makeText(requireContext(), "Using offline category choices. Check the service connection for current issues and municipalities.", Toast.LENGTH_LONG).show();
                }
            }
        });
    }

    private void selectCategory(String category) {
        selectedCategory = category;
        issueEdit.setText("", false);
        issueEdit.setAdapter(new ArrayAdapter<>(requireContext(), android.R.layout.simple_dropdown_item_1line, issueOptions.getOrDefault(category, new ArrayList<>())));
        if (categoryError != null) categoryError.setVisibility(View.GONE);
        populateCategoryGrid();
    }

    private void populateCategoryGrid() {
        if (categoryGrid == null || !isAdded()) return;
        categoryGrid.removeAllViews();
        for (String category : categoryOptions) {
            boolean selected = category.equals(selectedCategory);
            int accent = categoryAccent(category);

            FrameLayout tile = new FrameLayout(requireContext());
            tile.setBackgroundResource(selected
                    ? R.drawable.web_category_tile_selected
                    : R.drawable.web_category_tile);
            tile.setClickable(true);
            tile.setFocusable(true);
            tile.setContentDescription(category + (selected ? ", selected" : ""));
            tile.setOnClickListener(view -> selectCategory(category));

            LinearLayout content = new LinearLayout(requireContext());
            content.setGravity(Gravity.CENTER);
            content.setOrientation(LinearLayout.VERTICAL);
            content.setPadding(dp(8), dp(10), dp(8), dp(10));

            FrameLayout iconBubble = new FrameLayout(requireContext());
            GradientDrawable bubbleBackground = new GradientDrawable();
            bubbleBackground.setShape(GradientDrawable.OVAL);
            bubbleBackground.setColor(selected
                    ? accent
                    : Color.argb(24, Color.red(accent), Color.green(accent), Color.blue(accent)));
            iconBubble.setBackground(bubbleBackground);
            LinearLayout.LayoutParams bubbleParams = new LinearLayout.LayoutParams(dp(44), dp(44));
            bubbleParams.bottomMargin = dp(8);

            ImageView icon = new ImageView(requireContext());
            icon.setImageResource(categoryIcon(category));
            icon.setColorFilter(selected ? Color.WHITE : accent);
            FrameLayout.LayoutParams iconParams = new FrameLayout.LayoutParams(dp(22), dp(22), Gravity.CENTER);
            iconBubble.addView(icon, iconParams);
            content.addView(iconBubble, bubbleParams);

            TextView label = new TextView(requireContext());
            label.setGravity(Gravity.CENTER);
            label.setMaxLines(2);
            label.setText(category);
            label.setTextColor(getResources().getColor(selected ? R.color.web_primary : R.color.web_text));
            label.setTextSize(12);
            if (selected) label.setTypeface(label.getTypeface(), android.graphics.Typeface.BOLD);
            content.addView(label, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            tile.addView(content, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            if (selected) {
                TextView check = new TextView(requireContext());
                check.setGravity(Gravity.CENTER);
                check.setText("✓");
                check.setTextColor(Color.WHITE);
                check.setTextSize(11);
                GradientDrawable checkBackground = new GradientDrawable();
                checkBackground.setShape(GradientDrawable.OVAL);
                checkBackground.setColor(Color.parseColor("#1E5A7D"));
                check.setBackground(checkBackground);
                FrameLayout.LayoutParams checkParams = new FrameLayout.LayoutParams(dp(20), dp(20), Gravity.TOP | Gravity.END);
                checkParams.setMargins(0, dp(6), dp(6), 0);
                tile.addView(check, checkParams);
            }

            GridLayout.LayoutParams tileParams = new GridLayout.LayoutParams(
                    GridLayout.spec(GridLayout.UNDEFINED),
                    GridLayout.spec(GridLayout.UNDEFINED, 1f));
            tileParams.width = 0;
            tileParams.height = dp(94);
            tileParams.setMargins(0, 0, dp(8), dp(8));
            categoryGrid.addView(tile, tileParams);
        }
    }

    private int categoryIcon(String category) {
        switch (category) {
            case "Water & Sanitation": return R.drawable.ic_category_water;
            case "Electricity": return R.drawable.ic_category_electricity;
            case "Roads & Potholes": return R.drawable.ic_category_roads;
            case "Street Lighting": return R.drawable.ic_category_streetlight;
            case "Waste Management": return R.drawable.ic_category_waste;
            case "Parks & Recreation": return R.drawable.ic_category_parks;
            default: return R.drawable.ic_category_other;
        }
    }

    private int categoryAccent(String category) {
        switch (category) {
            case "Water & Sanitation": return Color.parseColor("#3B82F6");
            case "Electricity": return Color.parseColor("#F59E0B");
            case "Roads & Potholes": return Color.parseColor("#F97316");
            case "Street Lighting": return Color.parseColor("#EAB308");
            case "Waste Management": return Color.parseColor("#10B981");
            case "Parks & Recreation": return Color.parseColor("#16A34A");
            default: return Color.parseColor("#64748B");
        }
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private List<String> stringList(Object value) {
        List<String> result = new ArrayList<>();
        if (value instanceof List<?>) for (Object item : (List<?>) value) if (item != null) result.add(String.valueOf(item));
        return result;
    }

    /* ---------- Keyword category suggestion ---------- */

    private void showCategorySuggestion() {
        String description = descEdit.getText() == null ? "" : descEdit.getText().toString();
        String detected = ServiceData.suggestCategory(description);
        suggestionStatus.setVisibility(View.VISIBLE);
        if (detected != null) {
            suggestionStatus.setText(getString(R.string.wc_category_suggested) + ": " + detected
                    + " - Category selected");
            suggestionStatus.setBackgroundColor(getResources().getColor(R.color.status_resolved_bg));
            suggestionStatus.setTextColor(getResources().getColor(R.color.status_resolved));
            selectCategory(detected);
        } else {
            suggestionStatus.setText(R.string.wc_category_suggestion_empty);
            suggestionStatus.setBackgroundColor(getResources().getColor(R.color.status_submitted_bg));
            suggestionStatus.setTextColor(getResources().getColor(R.color.urgency_high));
        }
    }

    /* ---------- Urgency ---------- */

    private void setUrgency(String level) {
        selectedUrgency = level;
        styleUrgencyButton(urgencyLow, "low".equals(level));
        styleUrgencyButton(urgencyMedium, "medium".equals(level));
        styleUrgencyButton(urgencyHigh, "high".equals(level));
    }

    private void styleUrgencyButton(Button button, boolean active) {
        if (button == null) return;
        button.setBackgroundResource(active ? R.drawable.web_hero_button : R.drawable.web_outline_button);
        button.setTextColor(getResources().getColor(active ? R.color.black : R.color.web_primary));
    }

    /* ---------- Municipality autocomplete ---------- */

    /* ---------- GPS + reverse geocode (web getMunicipality) ---------- */

    private void getGPSLocation() {
        if (!isAdded()) return;
        if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 100);
            return;
        }

        fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
            if (!isAdded() || getContext() == null) return;
            if (location != null) {
                reverseGeocode(location.getLatitude(), location.getLongitude());
            } else {
                Toast.makeText(requireContext(), "GPS location unavailable. Try again outdoors.",
                        Toast.LENGTH_LONG).show();
            }
        });
    }

    private void reverseGeocode(double lat, double lon) {
        SharedApi.service().reverseLocation(lat, lon).enqueue(new Callback<Map<String, Object>>() {
            @Override public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                if (!isAdded()) return;
                Map<String, Object> place = response.body();
                if (!response.isSuccessful() || place == null || !(place.get("location") instanceof String)) {
                    Toast.makeText(requireContext(), "Location lookup unavailable. Enter an address manually.", Toast.LENGTH_LONG).show();
                    return;
                }
                latitude = lat;
                longitude = lon;
                locationEdit.setText(String.valueOf(place.get("location")));
                String municipality = String.valueOf(place.get("municipality"));
                if (municipalityOptions.contains(municipality)) {
                    municipalityEdit.setText(municipality, false);
                    municipalityDetected.setVisibility(View.VISIBLE);
                    municipalityDetected.setText(getString(R.string.wc_municipality_nearest, municipality));
                } else Toast.makeText(requireContext(), "Choose your municipality from the list.", Toast.LENGTH_LONG).show();
            }
            @Override public void onFailure(Call<Map<String, Object>> call, Throwable error) {
                if (isAdded()) Toast.makeText(requireContext(), "Location lookup unavailable. Enter an address manually.", Toast.LENGTH_LONG).show();
            }
        });
    }

    private void readPhoto(Uri uri) {
        selectedPhoto = null;
        if (uri == null || !isAdded()) return;
        try (InputStream input = requireContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalArgumentException("Cannot read photo");
            byte[] chunk = new byte[8192];
            int count;
            while ((count = input.read(chunk)) != -1) {
                output.write(chunk, 0, count);
                if (output.size() > 3_000_000) throw new IllegalArgumentException("Photo exceeds 3 MB");
            }
            byte[] bytes = output.toByteArray();
            String type = requireContext().getContentResolver().getType(uri);
            if (bytes.length == 0 || !("image/jpeg".equals(type) && bytes.length > 3 && (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216 || "image/png".equals(type) && bytes.length > 8 && (bytes[0] & 255) == 137 || "image/webp".equals(type) && bytes.length > 12 && new String(bytes, 0, 4).equals("RIFF"))) throw new IllegalArgumentException("Choose a JPEG, PNG or WebP photo");
            selectedPhoto = new HashMap<>();
            selectedPhoto.put("contentType", type);
            selectedPhoto.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            ((TextView) requireView().findViewById(R.id.photo_status)).setText("Photo ready to submit with report");
        } catch (Exception error) {
            ((TextView) requireView().findViewById(R.id.photo_status)).setText(error.getMessage());
        }
    }

    /* ---------- Validation + submit ---------- */

    private void submitReport(View root) {
        String details = descEdit.getText() == null ? "" : descEdit.getText().toString().trim();
        String issue = issueEdit.getText() == null ? "" : issueEdit.getText().toString().trim();
        String description = issueOptions.getOrDefault(selectedCategory, new ArrayList<>()).contains(issue) ? issue + (details.isEmpty() ? "" : " — " + details) : details;
        String location = locationEdit.getText() == null ? "" : locationEdit.getText().toString().trim();
        String municipality = municipalityEdit.getText() == null ? "" : municipalityEdit.getText().toString().trim();

        boolean valid = true;
        if (selectedCategory == null || !categoryOptions.contains(selectedCategory)) {
            categoryError.setVisibility(View.VISIBLE);
            valid = false;
        }
        if (description.isEmpty()) {
            descriptionError.setVisibility(View.VISIBLE);
            descriptionError.setText(description.isEmpty()
                    ? getString(R.string.wc_description_required)
                    : getString(R.string.wc_description_min));
            valid = false;
        }
        if (location.isEmpty()) {
            locationError.setVisibility(View.VISIBLE);
            valid = false;
        }
        if (!municipalityOptions.contains(municipality)) {
            municipalityEdit.setError("Choose a municipality from the list");
            valid = false;
        }
        if (!valid) return;

        long now = System.currentTimeMillis();
        Report report = new Report();
        report.category = selectedCategory;
        report.description = description;
        report.location = location;
        report.municipality = municipality;
        report.urgency = selectedUrgency;
        report.status = "submitted";
        report.timestamp = now;
        report.publicReference = "RPT-" + now;
        report.points = Gamification.POINTS_PER_REPORT;
        report.latitude = latitude;
        report.longitude = longitude;

        DataRepository.getInstance(requireContext()).submitReport(report, selectedPhoto,
            new DataRepository.ReportSubmissionCallback() {
                @Override
                public void onSuccess(java.util.Map<String, Object> savedReport) {
                if (!isAdded()) return;
                Gamification.HeroProfile previous = Gamification.getHeroProfile(requireContext());
                Gamification.HeroProfile updated = Gamification.awardReportPoints(requireContext());
                boolean leveledUp = !Gamification.getHeroLevel(previous.points).level
                    .equals(Gamification.getHeroLevel(updated.points).level);
                Toast.makeText(requireContext(),
                    "Report submitted! +" + Gamification.POINTS_PER_REPORT + " Hero Points",
                    Toast.LENGTH_LONG).show();
                if (leveledUp) Toast.makeText(requireContext(), "Level up!", Toast.LENGTH_LONG).show();
                Navigation.findNavController(root).navigateUp();
                }

                @Override
                public void onFailure(String message) {
                if (isAdded()) Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show();
                }
            });
    }
}
