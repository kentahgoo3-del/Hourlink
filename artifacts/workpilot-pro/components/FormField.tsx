import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type FormFieldProps = TextInputProps & {
  label: string;
  prefix?: string;
};

export function FormField({ label, prefix, style, ...props }: FormFieldProps) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {prefix ? (
          <Text style={[styles.prefix, { color: colors.mutedForeground }]}>{prefix}</Text>
        ) : null}
        <TextInput
          style={[styles.input, { color: colors.foreground }, style]}
          placeholderTextColor={colors.mutedForeground}
          {...props}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  prefix: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 12,
  },
});
