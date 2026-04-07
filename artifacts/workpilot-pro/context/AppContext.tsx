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
  description: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  hourlyRate: number;
  billable: boolean;
  invoiceId: string | null;
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

export type UserSettings = {
  name: string;
  company: string;
  email: string;
  currency: string;
  defaultHourlyRate: number;
  defaultTaxPercent: number;
};

type AppContextType = {
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  quotes: Quote[];
  invoices: Invoice[];
  settings: UserSettings;
  activeTimer: TimeEntry | null;

  addClient: (client: Omit<Client, "id" | "createdAt">) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  addProject: (project: Omit<Project, "id" | "createdAt">) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  startTimer: (entry: Omit<TimeEntry, "id" | "startTime" | "endTime" | "durationSeconds" | "invoiceId">) => void;
  stopTimer: () => void;
  addTimeEntry: (entry: Omit<TimeEntry, "id">) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;

  addQuote: (quote: Omit<Quote, "id" | "createdAt" | "quoteNumber">) => void;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
  convertQuoteToInvoice: (quoteId: string) => void;

  addInvoice: (invoice: Omit<Invoice, "id" | "createdAt" | "invoiceNumber">) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  markInvoicePaid: (id: string) => void;

  updateSettings: (updates: Partial<UserSettings>) => void;

  getClientRevenue: (clientId: string) => number;
  getTotalRevenue: () => number;
  getUnbilledAmount: () => number;
  getOutstandingAmount: () => number;
};

const DEFAULT_SETTINGS: UserSettings = {
  name: "Your Name",
  company: "Your Company",
  email: "you@example.com",
  currency: "R",
  defaultHourlyRate: 500,
  defaultTaxPercent: 15,
};

const CLIENT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#ef4444", "#06b6d4", "#f97316",
];

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [c, p, t, q, i, s, at] = await Promise.all([
        AsyncStorage.getItem("clients"),
        AsyncStorage.getItem("projects"),
        AsyncStorage.getItem("timeEntries"),
        AsyncStorage.getItem("quotes"),
        AsyncStorage.getItem("invoices"),
        AsyncStorage.getItem("settings"),
        AsyncStorage.getItem("activeTimer"),
      ]);
      if (c) setClients(JSON.parse(c));
      if (p) setProjects(JSON.parse(p));
      if (t) setTimeEntries(JSON.parse(t));
      if (q) setQuotes(JSON.parse(q));
      if (i) setInvoices(JSON.parse(i));
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
      if (at) setActiveTimer(JSON.parse(at));
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
      const next = [
        ...prev,
        {
          ...client,
          id: genId(),
          createdAt: new Date().toISOString(),
          color: client.color || CLIENT_COLORS[prev.length % CLIENT_COLORS.length],
        },
      ];
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
  const startTimer = useCallback((entry: Omit<TimeEntry, "id" | "startTime" | "endTime" | "durationSeconds" | "invoiceId">) => {
    const timer: TimeEntry = {
      ...entry,
      id: genId(),
      startTime: new Date().toISOString(),
      endTime: null,
      durationSeconds: 0,
      invoiceId: null,
    };
    setActiveTimer(timer);
    save("activeTimer", timer);
  }, [save]);

  const stopTimer = useCallback(() => {
    setActiveTimer((prev) => {
      if (!prev) return null;
      const endTime = new Date().toISOString();
      const durationSeconds = Math.floor(
        (new Date(endTime).getTime() - new Date(prev.startTime).getTime()) / 1000
      );
      const completed: TimeEntry = { ...prev, endTime, durationSeconds };
      setTimeEntries((entries) => {
        const next = [completed, ...entries];
        save("timeEntries", next);
        return next;
      });
      save("activeTimer", null);
      return null;
    });
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
  let quoteCounter = quotes.length + 1;
  const addQuote = useCallback((quote: Omit<Quote, "id" | "createdAt" | "quoteNumber">) => {
    setQuotes((prev) => {
      const num = (prev.length + 1).toString().padStart(4, "0");
      const next = [
        ...prev,
        { ...quote, id: genId(), createdAt: new Date().toISOString(), quoteNumber: `QT-${num}` },
      ];
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

  const convertQuoteToInvoice = useCallback((quoteId: string) => {
    setQuotes((prevQuotes) => {
      const quote = prevQuotes.find((q) => q.id === quoteId);
      if (!quote) return prevQuotes;
      setInvoices((prevInvoices) => {
        const num = (prevInvoices.length + 1).toString().padStart(4, "0");
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const invoice: Invoice = {
          id: genId(),
          clientId: quote.clientId,
          invoiceNumber: `INV-${num}`,
          title: quote.title,
          items: quote.items.map((item) => ({ ...item, id: genId() })),
          notes: quote.notes,
          taxPercent: quote.taxPercent,
          status: "draft",
          createdAt: new Date().toISOString(),
          dueDate: dueDate.toISOString(),
          paidAt: null,
          quoteId: quoteId,
        };
        const next = [invoice, ...prevInvoices];
        save("invoices", next);
        return next;
      });
      const updatedQuotes = prevQuotes.map((q) =>
        q.id === quoteId ? { ...q, status: "accepted" as const } : q
      );
      save("quotes", updatedQuotes);
      return updatedQuotes;
    });
  }, [save]);

  // Invoices
  const addInvoice = useCallback((invoice: Omit<Invoice, "id" | "createdAt" | "invoiceNumber">) => {
    setInvoices((prev) => {
      const num = (prev.length + 1).toString().padStart(4, "0");
      const next = [
        ...prev,
        {
          ...invoice,
          id: genId(),
          createdAt: new Date().toISOString(),
          invoiceNumber: `INV-${num}`,
        },
      ];
      save("invoices", next);
      return next;
    });
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

  // Settings
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      save("settings", next);
      return next;
    });
  }, [save]);

  // Computed
  const getClientRevenue = useCallback((clientId: string) => {
    return invoices
      .filter((inv) => inv.clientId === clientId && inv.status === "paid")
      .reduce((sum, inv) => {
        const subtotal = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + subtotal * (1 + inv.taxPercent / 100);
      }, 0);
  }, [invoices]);

  const getTotalRevenue = useCallback(() => {
    return invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => {
        const subtotal = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + subtotal * (1 + inv.taxPercent / 100);
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
        const subtotal = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + subtotal * (1 + inv.taxPercent / 100);
      }, 0);
  }, [invoices]);

  if (!loaded) return null;

  return (
    <AppContext.Provider
      value={{
        clients,
        projects,
        timeEntries,
        quotes,
        invoices,
        settings,
        activeTimer,
        addClient,
        updateClient,
        deleteClient,
        addProject,
        updateProject,
        deleteProject,
        startTimer,
        stopTimer,
        addTimeEntry,
        updateTimeEntry,
        deleteTimeEntry,
        addQuote,
        updateQuote,
        deleteQuote,
        convertQuoteToInvoice,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        markInvoicePaid,
        updateSettings,
        getClientRevenue,
        getTotalRevenue,
        getUnbilledAmount,
        getOutstandingAmount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
