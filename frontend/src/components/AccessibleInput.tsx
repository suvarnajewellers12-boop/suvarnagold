import { Input } from "@/components/ui/input";
import { useSpeech } from "@/hooks/useSpeech";
import { useAccessibility } from "../components/context/AccessibilityContext";

type Props = {
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
};

export const AccessibleInput = ({ label, value, onChange, disabled }: Props) => {
    const { speak } = useSpeech();
    const { isEnabled } = useAccessibility();

    const handleFocus = () => {
        if (!isEnabled) return;
        speak(`Enter ${label}`);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value;

        // ✅ Remove leading zeros
        input = input.replace(/^0+(?=\d)/, "");

        const val = Number(input || 0);

        onChange(val);

        if (!isEnabled) return;

        speak(`Typed ${input}`);
    };

    return (
        <Input
            type="text"
            inputMode="numeric" value={value}
            disabled={disabled}
            onFocus={handleFocus}
            onChange={handleChange}
            className="text-lg font-bold pl-8"
        />
    );
};