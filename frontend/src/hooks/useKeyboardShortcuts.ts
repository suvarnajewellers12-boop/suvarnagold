import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccessibility } from "../components/context/AccessibilityContext";

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { isEnabled } = useAccessibility();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEnabled) return;

      const activeElement = document.activeElement as HTMLElement;
      const tag = activeElement?.tagName;

      // ❌ Ignore typing fields
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        activeElement?.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      console.log("⌨️ Key pressed:", key);

      switch (key) {
        case "h":
          navigate("/");
          break;

        case "p":
          navigate("/dashboard/products");
          break;

        case "s":
          navigate("/dashboard/create-scheme");
          break;

        case "r":
          navigate("/dashboard/reports");
          break;

        case "c":
          navigate("/dashboard/customers");
          break;

        case "d":
          navigate("/dashboard");
          break;

        case "m":
          navigate("/dashboard/store");
          break;

        case "l":
          navigate("/login");
          break;

        default:
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate, isEnabled]);
};