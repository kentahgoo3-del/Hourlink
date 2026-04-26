import { AppIcon } from "@/components/AppIcon";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { ClientBadge } from "@/components/ClientBadge";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";
import { UpgradeModal } from "@/components/UpgradeModal";

const CLIENT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#ef4444", "#06b6d4", "#f97316",
];

const FREE_CLIENT_LIMIT = 3;

export default function ClientsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clients, addClient, invoices, settings } = useApp();
  const { isPro } = useSubscription();

  const [showAdd, setShowAdd] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState(settings.defaultHourlyRate.toString());
  const [selectedColor, setSelectedColor] = useState(CLIENT_COLORS[0]);

  const filtered = useMemo(() =>
    clients.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.company.toLowerCase().includes(search.toLowerCase())
    ),
    [clients, search]
  );

  const clientRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of invoices) {
      if (inv.status === "paid") {
        const total = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + inv.taxPercent / 100);
        map[inv.clientId] = (map[inv.clientId] || 0) + total;
      }
    }
    return map;
  }, [invoices]);

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a client name.");
      return;
    }
    if (!isPro && clients.length >= FREE_CLIENT_LIMIT) {
      setShowAdd(false);
      setShowUpgrade(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addClient({
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      hourlyRate: parseFloat(rate) || settings.defaultHourlyRate,
      currency: settings.currency,
      color: selectedColor,
    });
    setShowAdd(false);
    setName(""); setCompany(""); setEmail(""); setPhone(""); setRate(settings.defaultHourlyRate.toString());
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Clients</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (!isPro && clients.length >= FREE_CLIENT_LIMIT) {
              setShowUpgrade(true);
            } else {
              setShowAdd(true);
            }
          }}
          testID="add-client-btn"
        >
          <AppIcon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.muted }]}>
          <AppIcon name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search clients..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No clients yet"
          description="Add your first client to start tracking time and sending invoices."
          actionLabel="Add Client"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const rev = clientRevenue[item.id] || 0;
            const invCount = invoices.filter((inv) => inv.clientId === item.id).length;
            return (
              <TouchableOpacity
                style={[styles.clientCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/client/[id]", params: { id: item.id } })}
                testID={`client-card-${item.id}`}
              >
                <ClientBadge name={item.name} color={item.color} />
                <View style={styles.clientInfo}>
                  <Text style={[styles.clientName, { color: colors.foreground }]}>{item.name}</Text>
                  {item.company ? (
                    <Text style={[styles.clientCompany, { color: colors.mutedForeground }]}>{item.company}</Text>
                  ) : null}
                  <Text style={[styles.clientMeta, { color: colors.mutedForeground }]}>
                    {settings.currency}{item.hourlyRate}/hr · {invCount} invoice{invCount !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.clientRight}>
                  <Text style={[styles.clientRevenue, { color: colors.foreground }]}>
                    {settings.currency}{rev.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[styles.clientRevLabel, { color: colors.mutedForeground }]}>earned</Text>
                  <AppIcon name="chevron-forward" size={16} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="Client Limit Reached"
        description={`Free plan is limited to ${FREE_CLIENT_LIMIT} clients. Upgrade to Pro for unlimited clients and much more.`}
      />

      <BottomSheet visible={showAdd} onClose={() => setShowAdd(false)} title="New Client">
        <FormField label="Name *" placeholder="e.g., John Smith" value={name} onChangeText={setName} />
        <FormField label="Company" placeholder="e.g., Pharma Dynamics" value={company} onChangeText={setCompany} />
        <FormField label="Email" placeholder="john@company.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <FormField label="Phone" placeholder="+27 11 000 0000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <FormField label="Hourly Rate" prefix={settings.currency} placeholder="500" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
        <Text style={[styles.colorLabel, { color: colors.mutedForeground }]}>Color</Text>
        <View style={styles.colorRow}>
          {CLIENT_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorSelected]}
              onPress={() => setSelectedColor(c)}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleAdd}
          testID="save-client-btn"
        >
          <Text style={styles.saveBtnText}>Add Client</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  clientCompany: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  clientMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  clientRight: { alignItems: "flex-end" },
  clientRevenue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  clientRevLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  colorLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 10, letterSpacing: 0.3 },
  colorRow: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorSelected: { borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
