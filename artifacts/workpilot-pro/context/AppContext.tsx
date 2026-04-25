import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  hourlyRate: number;
  currency: string;
  color: string;
  createdAt: string;
};

export type Project = {
  id: string;
  clientId: string;
  name: string;
  description: string;
  status: "active" | "completed" | "paused";
  createdAt: string;
};

export type TimeEntry = {
  id: string;
  clientId: string;
  projectId: string;
  taskId: string | null;
  description: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  hourlyRate: number;
  billable: boolean;
  invoiceId: string | null;
  resumeEntryId?: string | null;
  // Multi-timer fields
  pausedSeconds?: number;     // accumulated seconds from completed sessions
  timerPaused?: boolean;      // is this timer currently paused?
  sessionStartTime?: string;  // when the current running session began
};

export type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type Quote = {
  id: string;
  clientId: string;
  quoteNumber: string;
  title: string;
  items: QuoteItem[];
  notes: string;
  taxPercent: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  createdAt: string;
  validUntil: string;
};

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  clientId: string;
  invoiceNumber: string;
  title: string;
  items: InvoiceItem[];
  notes: string;
  taxPercent: number;
  status: "draft" | "sent" | "paid" | "overdue";
  createdAt: string;
  dueDate: string;
  paidAt: string | null;
  quoteId: string | null;
};

export type Expense = {
  id: string;
  clientId: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  invoiceId: string | null;
};

export type QuoteTemplate = {
  id: string;
  name: string;
  items: QuoteItem[];
  taxPercent: number;
  notes: string;
};

export type ClientNote = {
  id: string;
  clientId: string;
  text: string;
  createdAt: string;
};

export type Meeting = {
  id: string;
  clientId: string;
  title: string;
  durationMinutes: number;
  notes: string;
  date: string;
};

export type Task = {
  id: string;
  clientId: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  estimatedHours: number | null;
  hourlyRate: number | null;
  createdAt: string;
  completedAt: string | null;
  portalTaskId?: string | null;
};

export type TaskComment = {
  id: string;
  taskId: string;
  timeEntryId?: string | null;
  authorName: string;
  text: string;
  createdAt: string;
  synced?: boolean;
};

export type CompanyProfile = {
  name: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  vatNumber: string;
  paymentTerms: string;
  bankName: string;
  bankAccount: string;
  bankBranch: string;
};

export type UserSettings = {
  name: string;
  company: string;
  email: string;
  currency: string;
  defaultHourlyRate: number;
  defaultTaxPercent: number;
  profitGoal: number;
  billingReminderDays: number;
  timerAlertThresholdHours: number;
};

const DEFAULT_SETTINGS: UserSettings = {
  name: "Your Name",
  company: "Your Company",
  email: "you@example.com",
  currency: "R",
  defaultHourlyRate: 500,
  defaultTaxPercent: 15,
  profitGoal: 50000,
  billingReminderDays: 7,
  timerAlertThresholdHours: 2,
};

const DEFAULT_COMPANY: CompanyProfile = {
  name: "",
  tagline: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  country: "South Africa",
  postalCode: "",
  phone: "",
  email: "",
  website: "",
  vatNumber: "",
  paymentTerms: "Payment due within 30 days of invoice date.",
  bankName: "",
  bankAccount: "",
  bankBranch: "",
};

export const CLIENT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#ef4444", "#06b6d4", "#f97316",
];

export type BillingAlert = {
  clientId: string;
  clientName: string;
  clientColor: string;
  unbilledHours: number;
  unbilledAmount: number;
  daysSinceBilled: number;
};

export type CashFlowItem = {
  label: string;
  amount: number;
  dueDate: string;
  clientName: string;
};

type AppContextType = {
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  quotes: Quote[];
  invoices: Invoice[];
  expenses: Expense[];
  quoteTemplates: QuoteTemplate[];
  clientNotes: ClientNote[];
  meetings: Meeting[];
  tasks: Task[];
  settings: UserSettings;
  companyProfile: CompanyProfile;
  activeTimers: TimeEntry[];

  addClient: (client: Omit<Client, "id" | "createdAt">) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  addProject: (project: Omit<Project, "id" | "createdAt">) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  startTimer: (entry: Omit<TimeEntry, "id" | "projectId" | "startTime" | "endTime" | "durationSeconds" | "invoiceId" | "taskId" | "resumeEntryId" | "pausedSeconds" | "timerPaused" | "sessionStartTime"> & { projectId?: string; taskId?: string | null; resumeEntryId?: string | null }) => void;
  stopTimer: (id?: string) => TimeEntry | null;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  addTimeEntry: (entry: Omit<TimeEntry, "id">) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;

  addQuote: (quote: Omit<Quote, "id" | "createdAt" | "quoteNumber">) => void;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
  convertQuoteToInvoice: (quoteId: string) => string;

  addInvoice: (invoice: Omit<Invoice, "id" | "createdAt" | "invoiceNumber">) => string;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  markInvoicePaid: (id: string) => void;

  addExpense: (expense: Omit<Expense, "id">) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  addQuoteTemplate: (template: Omit<QuoteTemplate, "id">) => void;
  deleteQuoteTemplate: (id: string) => void;

  addClientNote: (note: Omit<ClientNote, "id" | "createdAt">) => void;
  deleteClientNote: (id: string) => void;

  addMeeting: (meeting: Omit<Meeting, "id">) => void;
  deleteMeeting: (id: string) => void;

  addTask: (task: Omit<Task, "id" | "createdAt" | "completedAt">) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;

  taskComments: TaskComment[];
  addTaskComment: (comment: Omit<TaskComment, "id" | "createdAt" | "synced"> & { synced?: boolean }) => TaskComment;
  getTaskComments: (taskId: string) => TaskComment[];
  getEntryComments: (timeEntryId: string) => TaskComment[];
  markCommentsSynced: (ids: string[]) => void;

  updateSettings: (updates: Partial<UserSettings>) => void;
  updateCompanyProfile: (updates: Partial<CompanyProfile>) => void;

  getClientRevenue: (clientId: string) => number;
  getClientProfit: (clientId: string) => number;
  getTotalRevenue: () => number;
  getUnbilledAmount: () => number;
  getOutstandingAmount: () => number;
  getBillingAlerts: () => BillingAlert[];
  getCashFlowForecast: () => CashFlowItem[];
  getMonthRevenue: () => number;
  getLastTimerSuggestion: () => { clientId: string; description: string; client: Client | undefined } | null;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [quoteTemplates, setQuoteTemplates] = useState<QuoteTemplate[]>([]);
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [activeTimers, setActiveTimers] = useState<TimeEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const keys = ["clients","projects","timeEntries","quotes","invoices","expenses","quoteTemplates","clientNotes","meetings","tasks","taskComments","settings","companyProfile","activeTimers","activeTimer"];
      const results = await AsyncStorage.multiGet(keys);
      const map: Record<string, string | null> = {};
      results.forEach(([k, v]) => { map[k] = v; });
      if (map.clients) setClients(JSON.parse(map.clients));
      if (map.projects) setProjects(JSON.parse(map.projects));
      if (map.timeEntries) setTimeEntries(JSON.parse(map.timeEntries));
      if (map.quotes) setQuotes(JSON.parse(map.quotes));
      if (map.invoices) {
        const invs: Invoice[] = JSON.parse(map.invoices);
        const now = new Date();
        const checked = invs.map((inv) => {
          if (inv.status === "sent" && new Date(inv.dueDate) < now) {
            return { ...inv, status: "overdue" as const };
          }
          return inv;
        });
        setInvoices(checked);
        AsyncStorage.setItem("invoices", JSON.stringify(checked));
      }
      if (map.expenses) setExpenses(JSON.parse(map.expenses));
      if (map.quoteTemplates) setQuoteTemplates(JSON.parse(map.quoteTemplates));
      if (map.clientNotes) setClientNotes(JSON.parse(map.clientNotes));
      if (map.meetings) setMeetings(JSON.parse(map.meetings));
      if (map.tasks) setTasks(JSON.parse(map.tasks));
      if (map.taskComments) setTaskComments(JSON.parse(map.taskComments));
      if (map.settings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(map.settings) });
      if (map.companyProfile) setCompanyProfile({ ...DEFAULT_COMPANY, ...JSON.parse(map.companyProfile) });
      if (map.activeTimers) {
        setActiveTimers(JSON.parse(map.activeTimers));
      } else if (map.activeTimer) {
        // Migrate from old single-timer storage
        const old: TimeEntry = JSON.parse(map.activeTimer);
        const migrated: TimeEntry[] = [{ ...old, pausedSeconds: 0, timerPaused: false, sessionStartTime: old.startTime }];
        setActiveTimers(migrated);
        AsyncStorage.setItem("activeTimers", JSON.stringify(migrated));
        AsyncStorage.removeItem("activeTimer");
      }
    } catch (_) {}
    setLoaded(true);
  };

  const save = useCallback(async (key: string, data: unknown) => {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }, []);

  const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 6);

  // Clients
  const addClient = useCallback((client: Omit<Client, "id" | "createdAt">) => {
    setClients((prev) => {
      const next = [...prev, { ...client, id: genId(), createdAt: new Date().toISOString() }];
      save("clients", next);
      return next;
    });
  }, [save]);

  const updateClient = useCallback((id: string, updates: Partial<Client>) => {
    setClients((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      save("clients", next);
      return next;
    });
  }, [save]);

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== id);
      save("clients", next);
      return next;
    });
  }, [save]);

  // Projects
  const addProject = useCallback((project: Omit<Project, "id" | "createdAt">) => {
    setProjects((prev) => {
      const next = [...prev, { ...project, id: genId(), createdAt: new Date().toISOString() }];
      save("projects", next);
      return next;
    });
  }, [save]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      save("projects", next);
      return next;
    });
  }, [save]);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      save("projects", next);
      return next;
    });
  }, [save]);

  // Timers
  const startTimer = useCallback((entry: Omit<TimeEntry, "id" | "projectId" | "startTime" | "endTime" | "durationSeconds" | "invoiceId" | "taskId" | "resumeEntryId" | "pausedSeconds" | "timerPaused" | "sessionStartTime"> & { projectId?: string; taskId?: string | null; resumeEntryId?: string | null }) => {
    const now = new Date().toISOString();
    const newTimer: TimeEntry = {
      ...entry, projectId: entry.projectId ?? "", taskId: entry.taskId ?? null, resumeEntryId: entry.resumeEntryId ?? null,
      id: genId(), startTime: now, sessionStartTime: now,
      endTime: null, durationSeconds: 0, invoiceId: null,
      pausedSeconds: 0, timerPaused: false,
    };
    setActiveTimers((prev) => {
      const next = [newTimer, ...prev];
      save("activeTimers", next);
      return next;
    });
  }, [save]);

  const pauseTimer = useCallback((id: string) => {
    const nowMs = Date.now();
    setActiveTimers((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id || t.timerPaused) return t;
        const sessionSecs = Math.floor((nowMs - new Date(t.sessionStartTime || t.startTime).getTime()) / 1000);
        return { ...t, timerPaused: true, pausedSeconds: (t.pausedSeconds || 0) + sessionSecs };
      });
      save("activeTimers", next);
      return next;
    });
  }, [save]);

  const resumeTimer = useCallback((id: string) => {
    const nowIso = new Date().toISOString();
    setActiveTimers((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, timerPaused: false, sessionStartTime: nowIso } : t
      );
      save("activeTimers", next);
      return next;
    });
  }, [save]);

  const stopTimer = useCallback((id?: string): TimeEntry | null => {
    let completed: TimeEntry | null = null;
    setActiveTimers((prev) => {
      const targetId = id ?? prev.find((t) => !t.timerPaused)?.id ?? prev[0]?.id;
      if (!targetId) return prev;
      const target = prev.find((t) => t.id === targetId);
      if (!target) return prev;

      const nowMs = Date.now();
      const endTime = new Date(nowMs).toISOString();
      const totalSecs = (target.pausedSeconds || 0) + (target.timerPaused ? 0 :
        Math.floor((nowMs - new Date(target.sessionStartTime || target.startTime).getTime()) / 1000));

      if (target.resumeEntryId) {
        setTimeEntries((entries) => {
          const idx = entries.findIndex((e) => e.id === target.resumeEntryId);
          if (idx >= 0) {
            const original = entries[idx];
            const updated = { ...original, durationSeconds: original.durationSeconds + totalSecs, endTime };
            completed = updated;
            const next = [...entries];
            next[idx] = updated;
            save("timeEntries", next);
            return next;
          }
          completed = { ...target, endTime, durationSeconds: totalSecs, resumeEntryId: null, timerPaused: false };
          const next = [completed!, ...entries];
          save("timeEntries", next);
          return next;
        });
      } else {
        completed = { ...target, endTime, durationSeconds: totalSecs, resumeEntryId: null, timerPaused: false };
        setTimeEntries((entries) => {
          const next = [completed!, ...entries];
          save("timeEntries", next);
          return next;
        });
      }

      const remaining = prev.filter((t) => t.id !== targetId);
      save("activeTimers", remaining);
      return remaining;
    });
    return completed;
  }, [save]);

  const addTimeEntry = useCallback((entry: Omit<TimeEntry, "id">) => {
    setTimeEntries((prev) => {
      const next = [{ ...entry, id: genId() }, ...prev];
      save("timeEntries", next);
      return next;
    });
  }, [save]);

  const updateTimeEntry = useCallback((id: string, updates: Partial<TimeEntry>) => {
    setTimeEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      save("timeEntries", next);
      return next;
    });
  }, [save]);

  const deleteTimeEntry = useCallback((id: string) => {
    setTimeEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save("timeEntries", next);
      return next;
    });
  }, [save]);

  // Quotes
  const addQuote = useCallback((quote: Omit<Quote, "id" | "createdAt" | "quoteNumber">) => {
    setQuotes((prev) => {
      const num = (prev.length + 1).toString().padStart(4, "0");
      const next = [...prev, { ...quote, id: genId(), createdAt: new Date().toISOString(), quoteNumber: `QT-${num}` }];
      save("quotes", next);
      return next;
    });
  }, [save]);

  const updateQuote = useCallback((id: string, updates: Partial<Quote>) => {
    setQuotes((prev) => {
      const next = prev.map((q) => (q.id === id ? { ...q, ...updates } : q));
      save("quotes", next);
      return next;
    });
  }, [save]);

  const deleteQuote = useCallback((id: string) => {
    setQuotes((prev) => {
      const next = prev.filter((q) => q.id !== id);
      save("quotes", next);
      return next;
    });
  }, [save]);

  const convertQuoteToInvoice = useCallback((quoteId: string): string => {
    let newInvoiceId = "";
    setQuotes((prevQuotes) => {
      const quote = prevQuotes.find((q) => q.id === quoteId);
      if (!quote) return prevQuotes;
      setInvoices((prevInvoices) => {
        const num = (prevInvoices.length + 1).toString().padStart(4, "0");
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const invoice: Invoice = {
          id: genId(), clientId: quote.clientId,
          invoiceNumber: `INV-${num}`, title: quote.title,
          items: quote.items.map((item) => ({ ...item, id: genId() })),
          notes: quote.notes, taxPercent: quote.taxPercent,
          status: "draft", createdAt: new Date().toISOString(),
          dueDate: dueDate.toISOString(), paidAt: null, quoteId,
        };
        newInvoiceId = invoice.id;
        const next = [invoice, ...prevInvoices];
        save("invoices", next);
        return next;
      });
      const updated = prevQuotes.map((q) => q.id === quoteId ? { ...q, status: "accepted" as const } : q);
      save("quotes", updated);
      return updated;
    });
    return newInvoiceId;
  }, [save]);

  // Invoices
  const addInvoice = useCallback((invoice: Omit<Invoice, "id" | "createdAt" | "invoiceNumber">): string => {
    let newId = "";
    setInvoices((prev) => {
      const num = (prev.length + 1).toString().padStart(4, "0");
      newId = genId();
      const next = [...prev, { ...invoice, id: newId, createdAt: new Date().toISOString(), invoiceNumber: `INV-${num}` }];
      save("invoices", next);
      return next;
    });
    return newId;
  }, [save]);

  const updateInvoice = useCallback((id: string, updates: Partial<Invoice>) => {
    setInvoices((prev) => {
      const next = prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv));
      save("invoices", next);
      return next;
    });
  }, [save]);

  const deleteInvoice = useCallback((id: string) => {
    setInvoices((prev) => {
      const next = prev.filter((inv) => inv.id !== id);
      save("invoices", next);
      return next;
    });
  }, [save]);

  const markInvoicePaid = useCallback((id: string) => {
    setInvoices((prev) => {
      const next = prev.map((inv) =>
        inv.id === id ? { ...inv, status: "paid" as const, paidAt: new Date().toISOString() } : inv
      );
      save("invoices", next);
      return next;
    });
  }, [save]);

  // Expenses
  const addExpense = useCallback((expense: Omit<Expense, "id">) => {
    setExpenses((prev) => {
      const next = [{ ...expense, id: genId() }, ...prev];
      save("expenses", next);
      return next;
    });
  }, [save]);

  const updateExpense = useCallback((id: string, updates: Partial<Expense>) => {
    setExpenses((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      save("expenses", next);
      return next;
    });
  }, [save]);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save("expenses", next);
      return next;
    });
  }, [save]);

  // Quote Templates
  const addQuoteTemplate = useCallback((template: Omit<QuoteTemplate, "id">) => {
    setQuoteTemplates((prev) => {
      const next = [...prev, { ...template, id: genId() }];
      save("quoteTemplates", next);
      return next;
    });
  }, [save]);

  const deleteQuoteTemplate = useCallback((id: string) => {
    setQuoteTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      save("quoteTemplates", next);
      return next;
    });
  }, [save]);

  // Client Notes
  const addClientNote = useCallback((note: Omit<ClientNote, "id" | "createdAt">) => {
    setClientNotes((prev) => {
      const next = [{ ...note, id: genId(), createdAt: new Date().toISOString() }, ...prev];
      save("clientNotes", next);
      return next;
    });
  }, [save]);

  const deleteClientNote = useCallback((id: string) => {
    setClientNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      save("clientNotes", next);
      return next;
    });
  }, [save]);

  // Meetings
  const addMeeting = useCallback((meeting: Omit<Meeting, "id">) => {
    setMeetings((prev) => {
      const next = [{ ...meeting, id: genId() }, ...prev];
      save("meetings", next);
      return next;
    });
  }, [save]);

  const deleteMeeting = useCallback((id: string) => {
    setMeetings((prev) => {
      const next = prev.filter((m) => m.id !== id);
      save("meetings", next);
      return next;
    });
  }, [save]);

  // Tasks
  const addTask = useCallback((task: Omit<Task, "id" | "createdAt" | "completedAt">): Task => {
    const newTask: Task = { ...task, id: genId(), createdAt: new Date().toISOString(), completedAt: null };
    setTasks((prev) => {
      const next = [newTask, ...prev];
      save("tasks", next);
      return next;
    });
    return newTask;
  }, [save]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      save("tasks", next);
      return next;
    });
  }, [save]);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      save("tasks", next);
      return next;
    });
  }, [save]);

  const completeTask = useCallback((id: string) => {
    setTasks((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, status: "done" as const, completedAt: new Date().toISOString() } : t);
      save("tasks", next);
      return next;
    });
  }, [save]);

  const addTaskComment = useCallback((comment: Omit<TaskComment, "id" | "createdAt" | "synced"> & { synced?: boolean }) => {
    const newComment: TaskComment = {
      ...comment,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString(),
      synced: comment.synced ?? false,
    };
    setTaskComments((prev) => {
      const next = [...prev, newComment];
      save("taskComments", next);
      return next;
    });
    return newComment;
  }, [save]);

  const getTaskComments = useCallback((taskId: string) => {
    return taskComments.filter((c) => c.taskId === taskId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [taskComments]);

  const getEntryComments = useCallback((timeEntryId: string) => {
    return taskComments.filter((c) => c.timeEntryId === timeEntryId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [taskComments]);

  const markCommentsSynced = useCallback((ids: string[]) => {
    setTaskComments((prev) => {
      const next = prev.map((c) => ids.includes(c.id) ? { ...c, synced: true } : c);
      save("taskComments", next);
      return next;
    });
  }, [save]);

  // Settings
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      save("settings", next);
      return next;
    });
  }, [save]);

  const updateCompanyProfile = useCallback((updates: Partial<CompanyProfile>) => {
    setCompanyProfile((prev) => {
      const next = { ...prev, ...updates };
      save("companyProfile", next);
      return next;
    });
  }, [save]);

  // Computed
  const getClientRevenue = useCallback((clientId: string) => {
    return invoices
      .filter((inv) => inv.clientId === clientId && inv.status === "paid")
      .reduce((sum, inv) => {
        const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + sub * (1 + inv.taxPercent / 100);
      }, 0);
  }, [invoices]);

  const getClientProfit = useCallback((clientId: string) => {
    const revenue = getClientRevenue(clientId);
    const costs = expenses
      .filter((e) => e.clientId === clientId)
      .reduce((s, e) => s + e.amount, 0);
    return revenue - costs;
  }, [invoices, expenses, getClientRevenue]);

  const getTotalRevenue = useCallback(() => {
    return invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => {
        const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + sub * (1 + inv.taxPercent / 100);
      }, 0);
  }, [invoices]);

  const getMonthRevenue = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return invoices
      .filter((inv) => inv.status === "paid" && new Date(inv.paidAt || inv.createdAt) >= start)
      .reduce((sum, inv) => {
        const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + sub * (1 + inv.taxPercent / 100);
      }, 0);
  }, [invoices]);

  const getUnbilledAmount = useCallback(() => {
    return timeEntries
      .filter((e) => e.billable && !e.invoiceId && e.endTime)
      .reduce((sum, e) => sum + (e.durationSeconds / 3600) * e.hourlyRate, 0);
  }, [timeEntries]);

  const getOutstandingAmount = useCallback(() => {
    return invoices
      .filter((inv) => inv.status === "sent" || inv.status === "overdue")
      .reduce((sum, inv) => {
        const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + sub * (1 + inv.taxPercent / 100);
      }, 0);
  }, [invoices]);

  const getBillingAlerts = useCallback((): BillingAlert[] => {
    const now = Date.now();
    const alerts: BillingAlert[] = [];
    for (const client of clients) {
      const unbilled = timeEntries.filter((e) => e.clientId === client.id && e.billable && !e.invoiceId && e.endTime);
      if (unbilled.length === 0) continue;
      const oldest = unbilled.reduce((oldest, e) => {
        const t = new Date(e.startTime).getTime();
        return t < oldest ? t : oldest;
      }, now);
      const daysSince = Math.floor((now - oldest) / (1000 * 60 * 60 * 24));
      if (daysSince >= (settings.billingReminderDays || 7)) {
        const unbilledHours = unbilled.reduce((s, e) => s + e.durationSeconds / 3600, 0);
        const unbilledAmount = unbilled.reduce((s, e) => s + (e.durationSeconds / 3600) * e.hourlyRate, 0);
        alerts.push({ clientId: client.id, clientName: client.name, clientColor: client.color, unbilledHours, unbilledAmount, daysSinceBilled: daysSince });
      }
    }
    return alerts.sort((a, b) => b.daysSinceBilled - a.daysSinceBilled);
  }, [clients, timeEntries, settings.billingReminderDays]);

  const getCashFlowForecast = useCallback((): CashFlowItem[] => {
    return invoices
      .filter((inv) => inv.status === "sent" || inv.status === "overdue")
      .map((inv) => {
        const client = clients.find((c) => c.id === inv.clientId);
        const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return {
          label: inv.invoiceNumber,
          amount: sub * (1 + inv.taxPercent / 100),
          dueDate: inv.dueDate,
          clientName: client?.name || "Unknown",
        };
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [invoices, clients]);

  const getLastTimerSuggestion = useCallback(() => {
    const last = timeEntries.find((e) => e.endTime);
    if (!last) return null;
    const client = clients.find((c) => c.id === last.clientId);
    return { clientId: last.clientId, description: last.description, client };
  }, [timeEntries, clients]);

  if (!loaded) return null;

  return (
    <AppContext.Provider value={{
      clients, projects, timeEntries, quotes, invoices,
      expenses, quoteTemplates, clientNotes, meetings, tasks,
      settings, companyProfile, activeTimers,
      addClient, updateClient, deleteClient,
      addProject, updateProject, deleteProject,
      startTimer, stopTimer, pauseTimer, resumeTimer, addTimeEntry, updateTimeEntry, deleteTimeEntry,
      addQuote, updateQuote, deleteQuote, convertQuoteToInvoice,
      addInvoice, updateInvoice, deleteInvoice, markInvoicePaid,
      addExpense, updateExpense, deleteExpense,
      addQuoteTemplate, deleteQuoteTemplate,
      addClientNote, deleteClientNote,
      addMeeting, deleteMeeting,
      addTask, updateTask, deleteTask, completeTask,
      taskComments, addTaskComment, getTaskComments, getEntryComments, markCommentsSynced,
      updateSettings, updateCompanyProfile,
      getClientRevenue, getClientProfit, getTotalRevenue, getUnbilledAmount,
      getOutstandingAmount, getBillingAlerts, getCashFlowForecast,
      getMonthRevenue, getLastTimerSuggestion,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
