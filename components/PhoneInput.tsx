import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { StatusBar, Platform } from "react-native";
import { useTheme } from "@/lib/theme";

const COUNTRIES = [
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { code: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
  { code: "FI", name: "Finland", dialCode: "+358", flag: "🇫🇮" },
  { code: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱" },
  { code: "CZ", name: "Czech Republic", dialCode: "+420", flag: "🇨🇿" },
  { code: "HU", name: "Hungary", dialCode: "+36", flag: "🇭🇺" },
  { code: "GR", name: "Greece", dialCode: "+30", flag: "🇬🇷" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪" },
  { code: "LU", name: "Luxembourg", dialCode: "+352", flag: "🇱🇺" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰" },
  { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "MA", name: "Morocco", dialCode: "+212", flag: "🇲🇦" },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷" },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺" },
  { code: "UA", name: "Ukraine", dialCode: "+380", flag: "🇺🇦" },
  { code: "BY", name: "Belarus", dialCode: "+375", flag: "🇧🇾" },
  { code: "LT", name: "Lithuania", dialCode: "+370", flag: "🇱🇹" },
  { code: "LV", name: "Latvia", dialCode: "+371", flag: "🇱🇻" },
  { code: "EE", name: "Estonia", dialCode: "+372", flag: "🇪🇪" },
];

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onChangeFormattedText: (text: string) => void;
  placeholder?: string;
  defaultCode?: string;
  containerStyle?: any;
  textInputStyle?: any;
}

export default function PhoneInput({
  value,
  onChangeText,
  onChangeFormattedText,
  placeholder = "Enter phone number",
  defaultCode = "US",
  containerStyle,
  textInputStyle,
}: PhoneInputProps) {
  const { theme } = useTheme();
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find((country) => country.code === defaultCode) || COUNTRIES[0]
  );
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync selected country when defaultCode prop changes
  useEffect(() => {
    const next = COUNTRIES.find((c) => c.code === defaultCode);
    if (next && next.code !== selectedCountry.code) {
      setSelectedCountry(next);
    }
  }, [defaultCode]);

  // Ensure the text input contains only the national number (strip any dial code)
  useEffect(() => {
    if (!value) return;
    const startsWithPlus = value.startsWith("+");
    const currentDial = selectedCountry.dialCode; // e.g. +234
    let stripped = value;
    if (startsWithPlus) {
      // Remove any known country dial code prefix
      const sorted = [...COUNTRIES].sort(
        (a, b) => b.dialCode.length - a.dialCode.length
      );
      const match = sorted.find((c) => value.startsWith(c.dialCode));
      if (match) {
        stripped = value.slice(match.dialCode.length);
      } else {
        stripped = value.replace(/^\+/, "");
      }
    } else if (value.startsWith(currentDial)) {
      stripped = value.slice(currentDial.length);
    }
    if (stripped !== value) {
      onChangeText(stripped);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (value) {
      const formattedNumber = `${selectedCountry.dialCode}${value}`;
      onChangeFormattedText(formattedNumber);
    } else {
      onChangeFormattedText("");
    }
  }, [value, selectedCountry]);

  const filteredCountries = COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dialCode.includes(searchQuery) ||
      country.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCountrySelect = (country: (typeof COUNTRIES)[0]) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setSearchQuery("");
  };

  const renderCountryItem = ({ item }: { item: (typeof COUNTRIES)[0] }) => {
    const isSelected = item.code === selectedCountry.code;
    return (
      <TouchableOpacity
        style={[
          styles.countryItem,
          { borderBottomColor: theme.colors.border },
          isSelected && { backgroundColor: theme.colors.surface },
        ]}
        onPress={() => handleCountrySelect(item)}
      >
        <View style={styles.countryLeft}>
          <Image
            source={{
              uri: `https://flagcdn.com/w40/${item.code.toLowerCase()}.png`,
            }}
            style={styles.flagImage}
          />
          <Text style={[styles.countryName, { color: theme.colors.text }]}>
            {item.name}
          </Text>
        </View>
        <View style={styles.countryRight}>
          <Text style={[styles.dialCodeRight, { color: theme.colors.text }]}>
            {item.dialCode}
          </Text>
          {isSelected && (
            <Feather name="check" size={18} color={theme.colors.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.inputBg,
            borderColor: theme.colors.border,
          },
          containerStyle,
        ]}
      >
        <TouchableOpacity
          style={[
            styles.countrySelector,
            { borderRightColor: theme.colors.border },
          ]}
          onPress={() => setShowCountryPicker(true)}
        >
          <Image
            source={{
              uri: `https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`,
            }}
            style={styles.flagImage}
          />
          <Text style={[styles.dialCodeText, { color: theme.colors.text }]}>
            {selectedCountry.dialCode}
          </Text>
          <Feather
            name="chevron-down"
            size={16}
            color={theme.colors.mutedText}
          />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.textInput,
            { color: theme.colors.text },
            textInputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mutedText}
          keyboardType="phone-pad"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView
          style={[styles.modal, { backgroundColor: theme.colors.background }]}
        >
          <View
            style={[
              styles.modalHeader,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowCountryPicker(false);
                setSearchQuery("");
              }}
            >
              <Feather name="x" size={24} color={theme.colors.primaryText} />
            </TouchableOpacity>
            <Text
              style={[styles.modalTitle, { color: theme.colors.primaryText }]}
            >
              Select Country
            </Text>
            <View style={styles.placeholder} />
          </View>

          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Feather name="search" size={20} color={theme.colors.mutedText} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search countries..."
              placeholderTextColor={theme.colors.mutedText}
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
            style={styles.countryList}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgb(232, 240, 254)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    overflow: "hidden",
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: "#e9ecef",
    gap: 8,
  },
  flagImage: {
    width: 28,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#eee",
  },
  dialCodeText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#333",
  },
  modal: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#3A805B",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#3A805B",
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A805B",
  },
  countryItemSelected: {
    backgroundColor: "#e6f0ff",
  },
  countryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  countryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countryName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  dialCodeRight: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
});
