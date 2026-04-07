import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { ClientBadge } from "@/components/ClientBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField } from "@/components/FormField";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Tab = "overview" | "notes" | "meetings" | "expenses";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ClientDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    clients, invoices, quotes, timeEntries, expenses, clientNotes, meetings,
    updateClient, deleteClient, addClientNote, deleteClientNote,
    addMeeting, deleteMeeting, addExpense, deleteExpense,
    getClientRevenue, getClientProfit, settings,
  } = useApp();

  const client = clients.find((c) => c.id === id);
  const [tab, setTab] = useState<Tab>("overview");
  const [showEditClient, setShowEditClient] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDuration, setMeetingDuration] = useState("60");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("General");

  // Edit client fields
  const [editName, setEditName] = useState(client?.name || "");
  const [editCompany, setEditCompany] = useState(client?.company || "");
  const [editEmail, setEditEmail] = useState(client?.email || "");
  const [editPhone, setEditPhone] = useState(client?.phone || "");
  const [editRate, setEditRate] = useState(client?.hourlyRate?.toString() || "");
  const [showDeleteClientConfirm, setShowDeleteClientConfirm] = useState(false);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(null);
  const [pendingDeleteMeetingId, setPendingDeleteMeetingId] = useState<string | null>(null);
  const [pendingDeleteExpenseId, setPendingDeleteExpenseId] = useState<string | null>(null);

  const clientInvoices = useMemo(() => invoices.filter((inv) => inv.clientId === id), [invoices, id]);
  const clientQuotes = useMemo(() => quotes.filter((q) => q.clientId === id), [quotes, id]);
  const clientEntries = useMemo(() => timeEntries.filter((e) => e.clientId === id && e.endTime), [timeEntries, id]);
  const clientNotesList = useMemo(() => clientNotes.filter((n) => n.clientId === id), [clientNotes, id]);
  const clientMeetings = useMemo(() => meetings.filter((m) => m.clientId === id), [meetings, id]);
  const clientExpenses = useMemo(() => expenses.filter((e) => e.clientId === id), [expenses, id]);

  const totalHours = useMemo(() => clientEntries.reduce((s, e) => s + e.durationSeconds, 0) / 3600, [clientEntries]);
  const revenue = useMemo(() => getClientRevenue(id), [id, getClientRevenue]);
  const profit = useMemo(() => getClientProfit(id), [id, getClientProfit]);
  const totalExpensesAmt = useMemo(() => clientExpenses.reduce((s, e) => s + e.amount, 0), [clientExpenses]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!client) {
    return <View style={[styles.container, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground, textAlign: "center", marginTop: 100 }}>Client not found</Text></View>;
  }

  const handleDelete = () => setShowDeleteClientConfirm(true);

  const handleSaveClient = () => {
    updateClient(id, { name: editName, company: editCompany, email: editEmail, phone: editPhone, hourlyRate: parseFloat(editRate) || client.hourlyRate });
    setShowEditClient(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addClientNote({ clientId: id, text: noteText.trim() });
    setNoteText("");
    setShowAddNote(false);
  };

  const handleAddMeeting = () => {
    if (!meetingTitle.trim()) return;
    addMeeting({ clientId: id, title: meetingTitle.trim(), durationMinutes: parseInt(meetingDuration) || 60, notes: meetingNotes, date: new Date().toISOString() });
    setMeetingTitle(""); setMeetingDuration("60"); setMeetingNotes("");
    setShowAddMeeting(false);
  };

  const handleAddExpense = () => {
    if (!expenseDesc.trim() || !expenseAmount) return;
    addExpense({ clientId: id, description: expenseDesc.trim(), amount: parseFloat(expenseAmount) || 0, category: expenseCategory, date: new Date().toISOString(), invoiceId: null });
    setExpenseDesc(""); setExpenseAmount("");
    setShowAddExpense(false);
  };

  const EXPENSE_CATEGORIES = ["General", "Travel", "Materials", "Software", "Equipment", "Other"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ClientBadge name={client.name} color={client.color} />
          <Text style={[styles.headerName, { color: colors.foreground }]}>{client.name}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => { setEditName(client.name); setEditCompany(client.company); setEditEmail(client.email); setEditPhone(client.phone); setEditRate(client.hourlyRate.toString()); setShowEditClient(true); }} style={styles.headerBtn}>
            <Ionicons name="pencil" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sub header info */}
      <View style={[styles.clientMeta, { borderBottomColor: colors.border }]}>
        {client.company ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{client.company}</Text> : null}
        {client.email ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{client.email}</Text> : null}
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{settings.currency}{client.hourlyRate}/hr</Text>
      </View>

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {(["overview", "notes", "meetings", "expenses"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 40 }} showsVerticalScrollIndicator={false}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Revenue</Text>
                <Text style={[styles.statVal, { color: "#10b981" }]}>{formatCurrency(revenue, settings.currency)}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Net Profit</Text>
                <Text style={[styles.statVal, { color: profit >= 0 ? "#10b981" : "#ef4444" }]}>{formatCurrency(profit, settings.currency)}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Hours</Text>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{totalHours.toFixed(1)}h</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Expenses</Text>
                <Text style={[styles.statVal, { color: "#f59e0b" }]}>{formatCurrency(totalExpensesAmt, settings.currency)}</Text>
              </View>
            </View>

            {clientInvoices.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Invoices</Text>
                <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {clientInvoices.map((inv, idx) => {
                    const total = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + inv.taxPercent / 100);
                    return (
                      <TouchableOpacity key={inv.id} style={[styles.listRow, idx < clientInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: inv.id } })}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.listMain, { color: colors.foreground }]}>{inv.invoiceNumber}</Text>
                          <Text style={[styles.listSub, { color: colors.mutedForeground }]}>{formatDate(inv.createdAt)}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Text style={[styles.listAmt, { color: colors.foreground }]}>{formatCurrency(total, settings.currency)}</Text>
                          <StatusBadge status={inv.status} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {clientQuotes.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quotes</Text>
                <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {clientQuotes.map((q, idx) => {
                    const total = q.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + q.taxPercent / 100);
                    return (
                      <TouchableOpacity key={q.id} style={[styles.listRow, idx < clientQuotes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={() => router.push({ pathname: "/quote/[id]", params: { id: q.id } })}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.listMain, { color: colors.foreground }]}>{q.quoteNumber}</Text>
                          <Text style={[styles.listSub, { color: colors.mutedForeground }]}>{formatDate(q.createdAt)}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Text style={[styles.listAmt, { color: colors.foreground }]}>{formatCurrency(total, settings.currency)}</Text>
                          <StatusBadge status={q.status} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}

        {/* NOTES */}
        {tab === "notes" && (
          <>
            <TouchableOpacity style={[styles.addRowBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddNote(true)} testID="add-note-btn">
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addRowBtnText}>Add Note</Text>
            </TouchableOpacity>
            {clientNotesList.length === 0 && <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notes yet. Add context about this client.</Text>}
            {clientNotesList.map((note) => (
              <View key={note.id} style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.noteTop}>
                  <Text style={[styles.noteDate, { color: colors.mutedForeground }]}>{formatDate(note.createdAt)}</Text>
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPendingDeleteNoteId(note.id); }}>
                    <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.noteText, { color: colors.foreground }]}>{note.text}</Text>
              </View>
            ))}
          </>
        )}

        {/* MEETINGS */}
        {tab === "meetings" && (
          <>
            <TouchableOpacity style={[styles.addRowBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddMeeting(true)} testID="add-meeting-btn">
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addRowBtnText}>Log Meeting</Text>
            </TouchableOpacity>
            {clientMeetings.length === 0 && <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No meetings logged yet.</Text>}
            {clientMeetings.map((m) => (
              <View key={m.id} style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.noteTop}>
                  <Text style={[styles.noteDate, { color: colors.mutedForeground }]}>{formatDate(m.date)} · {m.durationMinutes}min</Text>
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPendingDeleteMeetingId(m.id); }}>
                    <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.noteText, { color: colors.foreground }]}>{m.title}</Text>
                {m.notes ? <Text style={[styles.noteSub, { color: colors.mutedForeground }]}>{m.notes}</Text> : null}
              </View>
            ))}
          </>
        )}

        {/* EXPENSES */}
        {tab === "expenses" && (
          <>
            <TouchableOpacity style={[styles.addRowBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddExpense(true)} testID="add-expense-btn">
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addRowBtnText}>Add Expense</Text>
            </TouchableOpacity>
            {clientExpenses.length > 0 && (
              <View style={[styles.expTotal, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
                <Text style={[styles.expTotalLabel, { color: colors.mutedForeground }]}>Total Expenses</Text>
                <Text style={[styles.expTotalAmt, { color: "#ef4444" }]}>{formatCurrency(totalExpensesAmt, settings.currency)}</Text>
              </View>
            )}
            {clientExpenses.length === 0 && <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No expenses logged for this client.</Text>}
            {clientExpenses.map((exp) => (
              <View key={exp.id} style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.noteTop}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.catBadge, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.catText, { color: colors.mutedForeground }]}>{exp.category}</Text>
                    </View>
                    <Text style={[styles.noteDate, { color: colors.mutedForeground }]}>{formatDate(exp.date)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPendingDeleteExpenseId(exp.id); }}>
                    <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <View style={styles.expRow}>
                  <Text style={[styles.noteText, { color: colors.foreground, flex: 1 }]}>{exp.description}</Text>
                  <Text style={[styles.expAmt, { color: "#ef4444" }]}>{formatCurrency(exp.amount, settings.currency)}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Edit Client Sheet */}
      <BottomSheet visible={showEditClient} onClose={() => setShowEditClient(false)} title="Edit Client">
        <FormField label="Name" value={editName} onChangeText={setEditName} placeholder="Client name" />
        <FormField label="Company" value={editCompany} onChangeText={setEditCompany} placeholder="Company name" />
        <FormField label="Email" value={editEmail} onChangeText={setEditEmail} placeholder="email@example.com" keyboardType="email-address" />
        <FormField label="Phone" value={editPhone} onChangeText={setEditPhone} placeholder="+27 000 000 0000" keyboardType="phone-pad" />
        <FormField label="Hourly Rate" prefix={settings.currency} value={editRate} onChangeText={setEditRate} placeholder="500" keyboardType="decimal-pad" />
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveClient}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Add Note Sheet */}
      <BottomSheet visible={showAddNote} onClose={() => setShowAddNote(false)} title="Add Note">
        <FormField label="Note" value={noteText} onChangeText={setNoteText} placeholder="Key contacts, preferences, ongoing context..." multiline numberOfLines={5} autoFocus />
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAddNote}>
          <Text style={styles.saveBtnText}>Save Note</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Log Meeting Sheet */}
      <BottomSheet visible={showAddMeeting} onClose={() => setShowAddMeeting(false)} title="Log Meeting">
        <FormField label="Meeting Title" value={meetingTitle} onChangeText={setMeetingTitle} placeholder="e.g., Kickoff call, Weekly sync" autoFocus />
        <FormField label="Duration (minutes)" value={meetingDuration} onChangeText={setMeetingDuration} placeholder="60" keyboardType="number-pad" />
        <FormField label="Notes" value={meetingNotes} onChangeText={setMeetingNotes} placeholder="What was discussed..." multiline numberOfLines={3} />
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAddMeeting}>
          <Text style={styles.saveBtnText}>Log Meeting</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Add Expense Sheet */}
      <BottomSheet visible={showAddExpense} onClose={() => setShowAddExpense(false)} title="Add Expense">
        <FormField label="Description" value={expenseDesc} onChangeText={setExpenseDesc} placeholder="e.g., Travel to client site" autoFocus />
        <FormField label="Amount" prefix={settings.currency} value={expenseAmount} onChangeText={setExpenseAmount} placeholder="0.00" keyboardType="decimal-pad" />
        <Text style={[styles.catLabel, { color: colors.mutedForeground }]}>Category</Text>
        <View style={styles.catRow}>
          {EXPENSE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, { backgroundColor: expenseCategory === cat ? colors.primary : colors.muted }]}
              onPress={() => setExpenseCategory(cat)}
            >
              <Text style={[styles.catChipText, { color: expenseCategory === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAddExpense}>
          <Text style={styles.saveBtnText}>Add Expense</Text>
        </TouchableOpacity>
      </BottomSheet>

      <ConfirmDialog
        visible={showDeleteClientConfirm}
        title="Delete Client"
        message={`Remove ${client.name} and all associated data? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => { setShowDeleteClientConfirm(false); deleteClient(id); router.back(); }}
        onCancel={() => setShowDeleteClientConfirm(false)}
      />
      <ConfirmDialog
        visible={!!pendingDeleteNoteId}
        title="Delete Note"
        message="Remove this note? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (pendingDeleteNoteId) deleteClientNote(pendingDeleteNoteId); setPendingDeleteNoteId(null); }}
        onCancel={() => setPendingDeleteNoteId(null)}
      />
      <ConfirmDialog
        visible={!!pendingDeleteMeetingId}
        title="Delete Meeting"
        message="Remove this meeting log? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (pendingDeleteMeetingId) deleteMeeting(pendingDeleteMeetingId); setPendingDeleteMeetingId(null); }}
        onCancel={() => setPendingDeleteMeetingId(null)}
      />
      <ConfirmDialog
        visible={!!pendingDeleteExpenseId}
        title="Delete Expense"
        message="Remove this expense? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (pendingDeleteExpenseId) deleteExpense(pendingDeleteExpenseId); setPendingDeleteExpenseId(null); }}
        onCancel={() => setPendingDeleteExpenseId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerActions: { flexDirection: "row", gap: 4 },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  clientMeta: { flexDirection: "row", gap: 12, flexWrap: "wrap", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  tabBar: { borderBottomWidth: 1 },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 4, marginRight: 20 },
  tabLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14 },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  listCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  listRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  listMain: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  listSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  listAmt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  addRowBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, justifyContent: "center", marginBottom: 16 },
  addRowBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 20, lineHeight: 20 },
  noteCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  noteTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  noteDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  noteText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  noteSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 18 },
  expRow: { flexDirection: "row", alignItems: "center" },
  expAmt: { fontSize: 15, fontFamily: "Inter_700Bold" },
  expTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 12 },
  expTotalLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  expTotalAmt: { fontSize: 18, fontFamily: "Inter_700Bold" },
  catBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  catLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8, letterSpacing: 0.3 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  catChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
