package com.example.mzansiconnect.ui.services;

public class Service {
    private String name;
    private String description;

    public Service(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public String getName() { return name; }
    public String getDescription() { return description; }
}