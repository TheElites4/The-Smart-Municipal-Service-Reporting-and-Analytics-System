package com.example.mzansiconnect.util;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Mirrors Citizen Portal Mobile App `src/app/utils/rsaMunicipalities.ts`.
 * Provides the municipality directory (name + province + type) and a sorted
 * name list used by the report form's municipality autocomplete.
 */
public final class Municipalities {

    public static final class Municipality {

        public final String name;
        public final String province;
        public final String type; // Metropolitan | District | Local

        public Municipality(String name, String province) {
            this.name = name;
            this.province = province;
            if (name.contains("Metropolitan")) {
                this.type = "Metropolitan";
            } else if (name.contains("District")) {
                this.type = "District";
            } else {
                this.type = "Local";
            }
        }
    }

    private Municipalities() {
    }

    private static final String[] EC = {
        "Buffalo City Metropolitan Municipality", "Nelson Mandela Bay Metropolitan Municipality",
        "Amathole District Municipality", "Alfred Nzo District Municipality", "Chris Hani District Municipality",
        "Joe Gqabi District Municipality", "OR Tambo District Municipality", "Sarah Baartman District Municipality",
        "Amahlathi Local Municipality", "Blue Crane Route Local Municipality", "Dr AB Xuma Local Municipality",
        "Dr Beyers Naude Local Municipality", "Enoch Mgijima Local Municipality", "Great Kei Local Municipality",
        "Ingquza Hill Local Municipality", "Intsika Yethu Local Municipality", "Inxuba Yethemba Local Municipality",
        "Kareeberg Local Municipality", "Kouga Local Municipality", "Kou-Kamma Local Municipality",
        "Makana Local Municipality", "Mbhashe Local Municipality", "Mbizana Local Municipality",
        "Mnquma Local Municipality", "Ndlambe Local Municipality", "Ngqushwa Local Municipality",
        "Ntabankulu Local Municipality", "Nyandeni Local Municipality", "Port St Johns Local Municipality",
        "Raymond Mhlaba Local Municipality", "Senqu Local Municipality", "Sundays River Valley Local Municipality",
        "Thembelihle Local Municipality", "Walter Sisulu Local Municipality"
    };

    private static final String[] FS = {
        "Mangaung Metropolitan Municipality", "Fezile Dabi District Municipality", "Lejweleputswa District Municipality",
        "Thabo Mofutsanyana District Municipality", "Xhariep District Municipality", "Dihlabeng Local Municipality",
        "Kopanong Local Municipality", "Mantsopa Local Municipality", "Masilonyana Local Municipality",
        "Matjhabeng Local Municipality", "Mohokare Local Municipality", "Moqhaka Local Municipality",
        "Nala Local Municipality", "Ngwathe Local Municipality", "Phumelela Local Municipality",
        "Setsoto Local Municipality", "Tokologo Local Municipality", "Tswelopele Local Municipality"
    };

    private static final String[] GP = {
        "City of Johannesburg Metropolitan Municipality", "City of Tshwane Metropolitan Municipality",
        "Ekurhuleni Metropolitan Municipality", "Sedibeng District Municipality", "West Rand District Municipality",
        "Lesedi Local Municipality", "Midvaal Local Municipality", "Merafong City Local Municipality",
        "Mogale City Local Municipality", "Rand West City Local Municipality", "Emfuleni Local Municipality"
    };

    private static final String[] KZN = {
        "eThekwini Metropolitan Municipality", "Amajuba District Municipality", "Harry Gwala District Municipality",
        "iLembe District Municipality", "King Cetshwayo District Municipality", "Ugu District Municipality",
        "uMgungundlovu District Municipality", "uMkhanyakude District Municipality", "uMzinyathi District Municipality",
        "uThukela District Municipality", "Zuland District Municipality", "Alfred Duma Local Municipality",
        "Big Five Hlabisa Local Municipality", "Dr Nkosazana Dlamini Zuma Local Municipality",
        "Endumeni Local Municipality", "eMadlangeni Local Municipality", "Greater Giyani Local Municipality",
        "Greater Kokstad Local Municipality", "Impendle Local Municipality", "Inkosi Langalibalele Local Municipality",
        "Jozini Local Municipality", "KwaDukuza Local Municipality", "Mandeni Local Municipality",
        "Maphumulo Local Municipality", "Mthonjaneni Local Municipality", "Mtubatuba Local Municipality",
        "Newcastle Local Municipality", "Ndwedwe Local Municipality", "Nongoma Local Municipality",
        "Nquthu Local Municipality", "Ray Nkonyeni Local Municipality", "Richmond Local Municipality",
        "Ulundi Local Municipality", "Umhlabuyalingana Local Municipality", "uMhlathuze Local Municipality",
        "Umsobomvu Local Municipality", "Umvoti Local Municipality", "Umzimkhulu Local Municipality",
        "Umzumbe Local Municipality", "uPhongolo Local Municipality", "The Msunduzi Local Municipality"
    };

    private static final String[] LP = {
        "Capricorn District Municipality", "Mopani District Municipality", "Sekhukhune District Municipality",
        "Vhembe District Municipality", "Waterberg District Municipality", "Aganang Local Municipality",
        "Ba-Phalaborwa Local Municipality", "Elias Motsoaledi Local Municipality", "Ephraim Mogale Local Municipality",
        "Fetakgomo Tubatse Local Municipality", "Greater Letaba Local Municipality", "Greater Tzaneen Local Municipality",
        "Lephalale Local Municipality", "Makhado Local Municipality", "Maruleng Local Municipality",
        "Mogalakwena Local Municipality", "Molemole Local Municipality", "Musina Local Municipality",
        "Polokwane Local Municipality", "Thabazimbi Local Municipality", "Thulamela Local Municipality",
        "Blouberg Local Municipality", "Collins Chabane Local Municipality",
        "Modimolle-Mookgophong Local Municipality", "Mookgophong Local Municipality"
    };

    private static final String[] MP = {
        "City of Mbombela Local Municipality", "City of Matlosana Local Municipality", "Ehlanzeni District Municipality",
        "Gert Sibande District Municipality", "Nkangala District Municipality", "Chief Albert Luthuli Local Municipality",
        "Emakhazeni Local Municipality", "Emalahleni Local Municipality", "Emthanjeni Local Municipality",
        "Mbombela Local Municipality", "Msukaligwa Local Municipality", "Nkomazi Local Municipality",
        "Pixley ka Isaka Seme Local Municipality", "Steve Tshwete Local Municipality",
        "Thaba Chweu Local Municipality", "Thembisile Local Municipality", "Victor Khanye Local Municipality"
    };

    private static final String[] WC = {
        "City of Cape Town Metropolitan Municipality", "Cape Winelands District Municipality",
        "Central Karoo District Municipality", "Garden Route District Municipality", "Overberg District Municipality",
        "West Coast District Municipality", "Beaufort West Local Municipality", "Bergrivier Local Municipality",
        "Bitou Local Municipality", "Breede Valley Local Municipality", "Cederberg Local Municipality",
        "Drakenstein Local Municipality", "George Local Municipality", "Hessequa Local Municipality",
        "Kannaland Local Municipality", "Knysna Local Municipality", "Laingsburg Local Municipality",
        "Langeberg Local Municipality", "Matzikama Local Municipality", "Mossel Bay Local Municipality",
        "Prince Albert Local Municipality", "Saldanha Bay Local Municipality", "Stellenbosch Local Municipality",
        "Swartland Local Municipality", "Swellendam Local Municipality", "Theewaterskloof Local Municipality",
        "Witzenberg Local Municipality"
    };

    private static final String[] NC = {
        "Frances Baard District Municipality", "John Taolo Gaetsewe District Municipality",
        "Namakwa District Municipality", "Pixley ka Seme District Municipality", "ZF Mgcawu District Municipality",
        "Dawid Kruiper Local Municipality", "Dikgatlong Local Municipality", "Emthanjeni Local Municipality",
        "Ga-Segonyana Local Municipality", "Hantam Local Municipality", "Kgatelopele Local Municipality",
        "Khai-Ma Local Municipality", "Magareng Local Municipality", "Phokwane Local Municipality",
        "Renosterberg Local Municipality", "Siyancuma Local Municipality", "Siyathemba Local Municipality",
        "Tsantsabane Local Municipality", "Ubuntu Local Municipality"
    };

    private static final String[] NW = {
        "Dr Kenneth Kaunda District Municipality", "Dr Ruth Segomotsi Mompati District Municipality",
        "Ngaka Modiri Molema District Municipality", "Bojanala Platinum District Municipality",
        "JB Marks Local Municipality", "Kagisano-Molopo Local Municipality", "Kgetlengrivier Local Municipality",
        "Lekwa-Teemane Local Municipality", "Madibeng Local Municipality", "Mahikeng Local Municipality",
        "Maquassi Hills Local Municipality", "Matlosana Local Municipality", "Moretele Local Municipality",
        "Moses Kotane Local Municipality", "Naledi Local Municipality", "Ramotshere Moiloa Local Municipality",
        "Ratlou Local Municipality", "Rustenburg Local Municipality", "Tswaing Local Municipality",
        "Ventersdorp/Tlokwe Local Municipality"
    };

    public static final List<Municipality> RSA_MUNICIPALITIES = new ArrayList<>();

    static {
        add(RSA_MUNICIPALITIES, EC, "Eastern Cape");
        add(RSA_MUNICIPALITIES, FS, "Free State");
        add(RSA_MUNICIPALITIES, GP, "Gauteng");
        add(RSA_MUNICIPALITIES, KZN, "KwaZulu-Natal");
        add(RSA_MUNICIPALITIES, LP, "Limpopo");
        add(RSA_MUNICIPALITIES, MP, "Mpumalanga");
        add(RSA_MUNICIPALITIES, WC, "Western Cape");
        add(RSA_MUNICIPALITIES, NC, "Northern Cape");
        add(RSA_MUNICIPALITIES, NW, "North West");
    }

    private static void add(List<Municipality> target, String[] names, String province) {
        for (String name : names) {
            target.add(new Municipality(name, province));
        }
    }

    /**
     * Sorted, de-duplicated municipality names (web MUNICIPALITY_NAMES).
     */
    public static List<String> names() {
        Set<String> unique = new LinkedHashSet<>();
        for (Municipality m : RSA_MUNICIPALITIES) {
            unique.add(m.name);
        }
        List<String> sorted = new ArrayList<>(unique);
        Collections.sort(sorted);
        return sorted;
    }

    /**
     * Case-insensitive search over name and province (web
     * MunicipalityDirectory).
     */
    public static List<Municipality> search(String query) {
        if (query == null || query.trim().isEmpty()) {
            return new ArrayList<>(RSA_MUNICIPALITIES);
        }
        String lower = query.toLowerCase();
        List<Municipality> result = new ArrayList<>();
        for (Municipality m : RSA_MUNICIPALITIES) {
            if (m.name.toLowerCase().contains(lower) || m.province.toLowerCase().contains(lower)) {
                result.add(m);
            }
        }
        return result;
    }
}
