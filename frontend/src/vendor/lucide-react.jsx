import { forwardRef } from "react";
import {
  FiPlus,
  FiX,
  FiHome,
  FiUser,
  FiFileText,
  FiSettings,
  FiBarChart2,
  FiClock,
  FiTool,
} from "react-icons/fi";

const createIcon = (IconComponent, displayName) => {
  const Component = forwardRef(({ className = "", ...props }, ref) => (
    <IconComponent ref={ref} className={className} {...props} />
  ));
  Component.displayName = displayName;
  return Component;
};

export const Plus = createIcon(FiPlus, "Plus");
export const X = createIcon(FiX, "X");
export const Home = createIcon(FiHome, "Home");
export const User = createIcon(FiUser, "User");
export const FileText = createIcon(FiFileText, "FileText");
export const Settings = createIcon(FiSettings, "Settings");
export const BarChart = createIcon(FiBarChart2, "BarChart");
export const Clock = createIcon(FiClock, "Clock");
export const Wrench = createIcon(FiTool, "Wrench");
