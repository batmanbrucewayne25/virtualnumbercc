import { graphqlRequest } from "@/hasura";

export const getMstResellerByEmail = async ({ email }: any) => {
  const QUERY = `query GetMstResellerByEmail($email: String!) {
  mst_reseller(where: { email: { _eq: $email } }) {
    id
    address
    is_aadhaar_verified
    is_email_verified
    is_gst_verified
    is_pan_verified
    is_phone_verified
    signup_completed
    status
    current_step
    aadhaar_number
    business_name
    constitution_of_business
    dob
    email
    first_name
    gender
    gst_pan_number
    gstin
    gstin_status
    last_name
    legal_name
    nature_bus_activities
    pan_dob
    pan_full_name
    pan_number
    password_hash
    phone
    profile_image
    created_at
    updated_at
  }
}`;

  return graphqlRequest(QUERY, { email });
};

export const loginMstReseller = async ({ email }: any) => {
  const QUERY = `query GetMstReseller($email: String!) {
    mst_reseller(where: { email: { _eq: $email } }) {
      id
      created_at
      updated_at
      first_name
      aadhaar_number
      dob
      gender
      address
      profile_image
      pan_number
      pan_dob
      pan_full_name
      gstin
      gst_pan_number
      business_name
      legal_name
      gstin_status
      constitution_of_business
      nature_bus_activities
      status
      last_name
      password_hash
      current_step
      email
      phone
      is_email_verified
      is_phone_verified
      is_pan_verified
      is_aadhaar_verified
      is_gst_verified
      signup_completed
      business_address
    }
  }`;

  const result = await graphqlRequest(QUERY, { email });
  
  // Return the data in a consistent format
  if (result?.data?.mst_reseller && result.data.mst_reseller.length > 0) {
    return {
      success: true,
      user: result.data.mst_reseller[0],
    };
  }
  
  return {
    success: false,
    user: null,
  };
};

export const checkMstResellerExists = async ({ email, phone }: any) => {
  const CHECK = `query CheckMstResellerExists($email: String!, $phone: String!) {
  mst_reseller(where: { _or: [{ email: { _eq: $email } }, { phone: { _eq: $phone } }] }) {
    id
    email
    phone
  }
}`;

  return graphqlRequest(CHECK, { email, phone });
};

export const insertMstReseller = async ({ first_name, last_name, email, phone, password_hash }: any) => {
  const INSERT = `mutation InsertMstReseller($first_name: String, $last_name: String, $email: String, $phone: String, $password_hash: String) {
  insert_mst_reseller(objects: {first_name: $first_name, last_name: $last_name, email: $email, phone: $phone, password_hash: $password_hash, current_step: 1, is_email_verified: false, is_phone_verified: false, signup_completed: false, status: false}) {
    affected_rows
  }
}`;

  return graphqlRequest(INSERT, { first_name, last_name, email, phone, password_hash });
};

export const updateOtpVerificationStep = async ({ email }: any) => {
  const UPDATE_OTP = `mutation UpdateOtpVerificationStep($email: String!) {
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { is_email_verified: true, is_phone_verified: true, current_step: 3 }) {
    affected_rows
  }
}`;

  return graphqlRequest(UPDATE_OTP, { email });
};

export const updatePanStep = async ({ email, pan_number, pan_dob, pan_full_name }: any) => {
  const UPDATE_PAN = `mutation UpdatePanStep($email: String!, $pan_number: String, $pan_dob: String, $pan_full_name: String) {
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { pan_number: $pan_number, pan_dob: $pan_dob, pan_full_name: $pan_full_name, is_pan_verified: true, current_step: 4 }) {
    affected_rows
  }
}`;

  return graphqlRequest(UPDATE_PAN, { email, pan_number, pan_dob, pan_full_name });
};

export const updateAadhaarStep = async ({ email, aadhaar_number, dob, gender }: any) => {
  const UPDATE_AADHAAR = `mutation UpdateAadhaarStep($email: String!, $aadhaar_number: String, $dob: String, $gender: String) {
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { aadhaar_number: $aadhaar_number, dob: $dob, gender: $gender, is_aadhaar_verified: true, current_step: 5 }) {
    affected_rows
  }
}`;

  return graphqlRequest(UPDATE_AADHAAR, { email, aadhaar_number, dob, gender });
};

export const updateGstStep = async ({ email, gstin, gst_pan_number, business_name, legal_name, gstin_status, constitution_of_business, nature_bus_activities }: any) => {
  const UPDATE_GST = `mutation UpdateGstStep($email: String!, $gstin: String, $gst_pan_number: String, $business_name: String, $legal_name: String, $gstin_status: String, $constitution_of_business: String, $nature_bus_activities: String) {
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { gstin: $gstin, gst_pan_number: $gst_pan_number, business_name: $business_name, legal_name: $legal_name, gstin_status: $gstin_status, constitution_of_business: $constitution_of_business, nature_bus_activities: $nature_bus_activities, is_gst_verified: true, current_step: 6 }) {
    affected_rows
  }
}`;

  return graphqlRequest(UPDATE_GST, { email, gstin, gst_pan_number, business_name, legal_name, gstin_status, constitution_of_business, nature_bus_activities });
};

export const completeSignupStep = async ({ email, profile_image, address }: any) => {
  const COMPLETE = `mutation CompleteSignupStep($email: String!, $profile_image: String, $address: [String!]) {
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { profile_image: $profile_image, address: $address, signup_completed: true, status: true, current_step: 7 }) {
    affected_rows
  }
}`;

  return graphqlRequest(COMPLETE, { email, profile_image, address });
};

export default {
  getMstResellerByEmail,
  loginMstReseller,
  checkMstResellerExists,
  insertMstReseller,
  updateOtpVerificationStep,
  updatePanStep,
  updateAadhaarStep,
  updateGstStep,
  completeSignupStep,
};
