import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

export default function LabeledInput() {
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState('');

  return (
    <View style={styles.container}>
      <Text style={[styles.label, (isFocused || value) && styles.labelFocused]}>
        Your Label
      </Text>
      <TextInput
        style={[styles.textInput, isFocused && styles.inputFocused]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChangeText={setValue}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    margin: 20,
  },
  label: {
    position: 'absolute',
    left: 12,
    top: -12,
    fontSize: 14,
    color: '#888',
    backgroundColor: 'white',
    paddingHorizontal: 4,
  },
  labelFocused: {
    color: '#007AFF',
    fontWeight: '600',
  },
  textInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#000',
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
});
