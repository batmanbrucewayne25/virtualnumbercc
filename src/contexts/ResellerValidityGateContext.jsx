/* eslint-disable react/prop-types */
import { createContext, useContext } from "react";

const defaultValue = {
  loading: false,
  blocked: false,
  reason: "",
};

const ResellerValidityGateContext = createContext(defaultValue);

export function ResellerValidityGateProvider({ value, children }) {
  return (
    <ResellerValidityGateContext.Provider value={value ?? defaultValue}>
      {children}
    </ResellerValidityGateContext.Provider>
  );
}

export function useResellerValidityGate() {
  return useContext(ResellerValidityGateContext);
}

export default ResellerValidityGateContext;
