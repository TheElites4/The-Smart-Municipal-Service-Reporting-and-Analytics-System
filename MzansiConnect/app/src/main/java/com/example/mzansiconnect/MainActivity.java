package com.example.mzansiconnect;

import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;
import com.example.mzansiconnect.data.DataRepository;
import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);

        BottomNavigationView navView = findViewById(R.id.bottom_navigation);
        NavHostFragment navHostFragment = (NavHostFragment) getSupportFragmentManager()
                .findFragmentById(R.id.nav_host_fragment);
        if (navHostFragment != null) {
            NavController navController = navHostFragment.getNavController();
            
            AppBarConfiguration appBarConfiguration = new AppBarConfiguration.Builder(
                    R.id.navigation_home, R.id.navigation_dashboard,
                    R.id.navigation_chatbot, R.id.navigation_leaderboard, R.id.navigation_profile)
                    .build();
            NavigationUI.setupActionBarWithNavController(this, navController, appBarConfiguration);
            NavigationUI.setupWithNavController(navView, navController);

            navController.addOnDestinationChangedListener((controller, destination, arguments) -> {
                int id = destination.getId();
                if (id == R.id.navigation_splash || id == R.id.navigation_home || id == R.id.navigation_login || id == R.id.navigation_mfa || id == R.id.navigation_mfa_success || id == R.id.navigation_registration) {
                    navView.setVisibility(View.GONE);
                    if (getSupportActionBar() != null) {
                        getSupportActionBar().hide();
                    }
                } else {
                    navView.setVisibility(View.VISIBLE);
                    if (getSupportActionBar() != null) {
                        getSupportActionBar().show();
                    }
                }
            });
        }

        // Request Location & Notification permissions immediately on app launch
        List<String> permissions = new ArrayList<>();
        if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(android.Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(android.Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(android.Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (!permissions.isEmpty()) {
            requestPermissions(permissions.toArray(new String[0]), 200);
        }

        // Initialize / Sync FCM token
        DataRepository.getInstance(this).syncFcmTokenToFirebase();
    }

    private NavController getNavController() {
        NavHostFragment navHostFragment = (NavHostFragment) getSupportFragmentManager()
                .findFragmentById(R.id.nav_host_fragment);
        return navHostFragment != null ? navHostFragment.getNavController() : null;
    }

    @Override
    public boolean onCreateOptionsMenu(android.view.Menu menu) {
        getMenuInflater().inflate(R.menu.toolbar_menu, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull android.view.MenuItem item) {
        if (item.getItemId() == R.id.action_notifications) {
            NavController navController = getNavController();
            if (navController != null) {
                navController.navigate(R.id.navigation_notifications);
            }
            return true;
        } else if (item.getItemId() == R.id.action_language) {
            showLanguageDialog();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void showLanguageDialog() {
        String[] languages = {"🇬🇧 English", "🇿🇦 isiZulu", "🇿🇦 isiXhosa", "🇿🇦 Afrikaans"};
        String[] codes = {"en", "zu", "xh", "af"};

        new com.google.android.material.dialog.MaterialAlertDialogBuilder(this)
                .setTitle("Select Language / Khetha Ulimi")
                .setItems(languages, (dialog, which) -> {
                    String selectedCode = codes[which];
                    androidx.appcompat.app.AppCompatDelegate.setApplicationLocales(
                            androidx.core.os.LocaleListCompat.forLanguageTags(selectedCode)
                    );
                })
                .show();
    }

    @Override
    public boolean onSupportNavigateUp() {
        NavController navController = getNavController();
        return (navController != null && navController.navigateUp()) || super.onSupportNavigateUp();
    }
}
