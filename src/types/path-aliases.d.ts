// Type declarations for path aliases
declare module "@/hasura" {
  export const graphqlRequest: any;
  export const HASURA_ENDPOINT: any;
}

declare module "@/hasura/mutations" {
  const _default: any;
  export default _default;
  export const getMstResellerByEmail: any;
  export const loginMstReseller: any;
  export const insertMstReseller: any;
  export const updateOtpVerificationStep: any;
  export const updatePanStep: any;
  export const updateAadhaarStep: any;
  export const updateGstStep: any;
  export const completeSignupStep: any;
}

declare module "@/*" {
  const value: any;
  export default value;
}
