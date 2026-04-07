import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  File,
  FileText,
  Home,
  Image as ImageIcon,
  Info,
  LogIn,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  PlusCircle,
  Receipt,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  Square,
  Timer,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap,
  type LucideProps,
} from "lucide-react-native";
import React from "react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  add: Plus,
  "add-circle": PlusCircle,
  "add-circle-outline": PlusCircle,
  "alert-circle": AlertCircle,
  "alert-circle-outline": AlertCircle,
  "bar-chart": BarChart3,
  "bar-chart-outline": BarChart3,
  briefcase: FileText,
  "calendar-outline": Calendar,
  checkmark: Check,
  "checkmark-circle": CheckCircle,
  "checkmark-circle-outline": CheckCircle,
  "checkmark-done": CheckCheck,
  "chevron-back": ChevronLeft,
  "chevron-down": ChevronDown,
  "chevron-forward": ChevronRight,
  close: X,
  "close-circle": XCircle,
  "copy-outline": Copy,
  "document-outline": File,
  "document-text": FileText,
  "document-text-outline": FileText,
  "download-outline": Download,
  flash: Zap,
  home: Home,
  "home-outline": Home,
  "image-outline": ImageIcon,
  "information-circle-outline": Info,
  "log-in": LogIn,
  "paper-plane": Send,
  pencil: Pencil,
  people: Users,
  "people-outline": Users,
  "person-add-outline": UserPlus,
  play: Play,
  "play-circle": PlayCircle,
  "play-outline": Play,
  "receipt-outline": Receipt,
  refresh: RefreshCw,
  rocket: Rocket,
  "rocket-outline": Rocket,
  "search-outline": Search,
  send: Send,
  "settings-outline": Settings,
  stop: Square,
  "time-outline": Clock,
  timer: Timer,
  "timer-outline": Timer,
  trash: Trash2,
  "trash-outline": Trash2,
  "trending-up": TrendingUp,
};

interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export function AppIcon({ name, size = 24, color = "#000", style }: AppIconProps) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    return null;
  }
  return <IconComponent size={size} color={color} style={style} strokeWidth={1.8} />;
}

export default AppIcon;
