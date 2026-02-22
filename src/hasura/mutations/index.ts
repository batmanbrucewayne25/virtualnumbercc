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
    aadhar_photo
    business_name
    brand_name
    business_address
    business_email
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
    logo
    signatureImage
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
      brand_name
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
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { is_email_verified: true, current_step: 2 }) {
    affected_rows
  }
}`;

  return graphqlRequest(UPDATE_OTP, { email });
};

export const updatePhoneOtpVerificationStep = async ({ email }: any) => {
  const UPDATE_PHONE_OTP = `mutation UpdatePhoneOtpVerificationStep($email: String!) {
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { is_phone_verified: true, current_step: 3 }) {
    affected_rows
  }
}`;

  return graphqlRequest(UPDATE_PHONE_OTP, { email });
};

export const updatePanStep = async ({ email, pan_number, pan_dob, pan_full_name }: any) => {
  const UPDATE_PAN = `mutation UpdatePanStep($email: String!, $pan_number: String, $pan_dob: String, $pan_full_name: String) {
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { pan_number: $pan_number, pan_dob: $pan_dob, pan_full_name: $pan_full_name, is_pan_verified: true, current_step: 4 }) {
    affected_rows
  }
}`;

  return graphqlRequest(UPDATE_PAN, { email, pan_number, pan_dob, pan_full_name });
};

export const updateAadhaarStep = async ({ email, aadhaar_number, dob, gender, aadhar_photo, address }: any) => {
  // Build dynamic mutation - only include fields that have values
  const setFields: string[] = [];
  const variables: any = { email };
  const variableDefs: string[] = ['$email: String!'];

  // Always update these fields
  setFields.push('is_aadhaar_verified: true');
  setFields.push('current_step: 5');

  // Add fields only if they have values
  if (aadhaar_number !== undefined && aadhaar_number !== null && aadhaar_number !== '') {
    setFields.push('aadhaar_number: $aadhaar_number');
    variables.aadhaar_number = aadhaar_number;
    variableDefs.push('$aadhaar_number: String');
  }
  if (dob !== undefined && dob !== null && dob !== '') {
    setFields.push('dob: $dob');
    variables.dob = dob;
    variableDefs.push('$dob: String');
  }
  if (gender) {
    setFields.push('gender: $gender');
    variables.gender = gender;
    variableDefs.push('$gender: String');
  }
  if (aadhar_photo) {
    setFields.push('aadhar_photo: $aadhar_photo');
    variables.aadhar_photo = aadhar_photo;
    variableDefs.push('$aadhar_photo: String');
  }
  if (address) {
    setFields.push('address: $address');
    variables.address = address;
    variableDefs.push('$address: [String!]');
  }

  const UPDATE_AADHAAR = `mutation UpdateAadhaarStep(
    ${variableDefs.join('\n    ')}
  ) {
    update_mst_reseller(
      where: { email: { _eq: $email } }
      _set: {
        ${setFields.join('\n        ')}
      }
    ) {
      affected_rows
      returning {
        id
        aadhaar_number
        dob
        aadhar_photo
      }
    }
  }`;

  console.log("UpdateAadhaarStep mutation:", {
    variables: { ...variables, aadhar_photo: variables.aadhar_photo?.substring(0, 50) },
    setFields,
  });

  const result = await graphqlRequest(UPDATE_AADHAAR, variables);
  
  console.log("UpdateAadhaarStep result:", result);
  
  return result;
};

export const updateGstStep = async ({ email, gstin, gst_pan_number, business_name, legal_name, gstin_status, constitution_of_business, nature_bus_activities, business_address, business_email }: any) => {
  const UPDATE_GST = `mutation UpdateGstStep($email: String!, $gstin: String, $gst_pan_number: String, $business_name: String, $legal_name: String, $gstin_status: String, $constitution_of_business: String, $nature_bus_activities: String, $business_address: String, $business_email: String) {
  update_mst_reseller(where: { email: { _eq: $email } }, _set: { gstin: $gstin, gst_pan_number: $gst_pan_number, business_name: $business_name, legal_name: $legal_name, gstin_status: $gstin_status, constitution_of_business: $constitution_of_business, nature_bus_activities: $nature_bus_activities, business_address: $business_address, business_email: $business_email, is_gst_verified: true, current_step: 6 }) {
    affected_rows
  }
}`;

  const variables: any = { email, gstin, gst_pan_number, business_name, legal_name, gstin_status, constitution_of_business, nature_bus_activities };
  if (business_address) {
    variables.business_address = business_address;
  }
  if (business_email) {
    variables.business_email = business_email;
  }

  return graphqlRequest(UPDATE_GST, variables);
};

export const completeSignupStep = async ({ 
  email, 
  profile_image, 
  address, 
  brand_name, 
  signatureImage,
  // Preserve existing data
  aadhaar_number,
  dob,
  pan_number,
  pan_dob,
  pan_full_name,
  is_pan_verified,
  is_aadhaar_verified,
  business_address,
  business_email,
  aadhar_photo
}: any) => {
  // Build dynamic mutation - only include fields that have values
  const setFields: string[] = [];
  const variables: any = { email };
  const variableDefs: string[] = ['$email: String!'];

  // Always update these fields
  setFields.push('signup_completed: true');
  setFields.push('status: true');
  setFields.push('current_step: 7');

  // Add fields only if they have values
  if (profile_image) {
    setFields.push('profile_image: $profile_image');
    variables.profile_image = profile_image;
    variableDefs.push('$profile_image: String');
  }
  if (address && Array.isArray(address) && address.length > 0) {
    setFields.push('address: $address');
    variables.address = address;
    variableDefs.push('$address: [String!]');
  }
  if (brand_name) {
    setFields.push('brand_name: $brand_name');
    variables.brand_name = brand_name;
    variableDefs.push('$brand_name: String');
  }
  if (signatureImage) {
    setFields.push('signatureImage: $signatureImage');
    variables.signatureImage = signatureImage;
    variableDefs.push('$signatureImage: String');
  }
  if (aadhaar_number !== undefined && aadhaar_number !== null && aadhaar_number !== '') {
    setFields.push('aadhaar_number: $aadhaar_number');
    variables.aadhaar_number = aadhaar_number;
    variableDefs.push('$aadhaar_number: String');
  }
  if (dob !== undefined && dob !== null && dob !== '') {
    setFields.push('dob: $dob');
    variables.dob = dob;
    variableDefs.push('$dob: String');
  }
  if (pan_number) {
    setFields.push('pan_number: $pan_number');
    variables.pan_number = pan_number;
    variableDefs.push('$pan_number: String');
  }
  if (pan_dob) {
    setFields.push('pan_dob: $pan_dob');
    variables.pan_dob = pan_dob;
    variableDefs.push('$pan_dob: String');
  }
  if (pan_full_name) {
    setFields.push('pan_full_name: $pan_full_name');
    variables.pan_full_name = pan_full_name;
    variableDefs.push('$pan_full_name: String');
  }
  if (is_pan_verified !== undefined) {
    setFields.push('is_pan_verified: $is_pan_verified');
    variables.is_pan_verified = is_pan_verified;
    variableDefs.push('$is_pan_verified: Boolean');
  }
  if (is_aadhaar_verified !== undefined) {
    setFields.push('is_aadhaar_verified: $is_aadhaar_verified');
    variables.is_aadhaar_verified = is_aadhaar_verified;
    variableDefs.push('$is_aadhaar_verified: Boolean');
  }
  if (business_address) {
    setFields.push('business_address: $business_address');
    variables.business_address = business_address;
    variableDefs.push('$business_address: String');
  }
  if (business_email) {
    setFields.push('business_email: $business_email');
    variables.business_email = business_email;
    variableDefs.push('$business_email: String');
  }
  if (aadhar_photo) {
    setFields.push('aadhar_photo: $aadhar_photo');
    variables.aadhar_photo = aadhar_photo;
    variableDefs.push('$aadhar_photo: String');
  }

  const COMPLETE = `mutation CompleteSignupStep(
    ${variableDefs.join('\n    ')}
  ) {
    update_mst_reseller(
      where: { email: { _eq: $email } }
      _set: {
        ${setFields.join('\n        ')}
      }
    ) {
      affected_rows
      returning {
        id
        aadhaar_number
        dob
        profile_image
        signatureImage
        signup_completed
        aadhar_photo
      }
    }
  }`;

  console.log("CompleteSignupStep mutation:", {
    variables: { ...variables, profile_image: variables.profile_image?.substring(0, 50), signatureImage: variables.signatureImage?.substring(0, 50) },
    setFields,
  });

  const result = await graphqlRequest(COMPLETE, variables);
  
  console.log("CompleteSignupStep result:", result);
  
  return result;
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

// Export customer mutations
export * from "./customer";

// Export transaction mutations
export * from "./transaction";

// Export user mutations
export * from "./user";

// Export CMS mutations
export * from "./cms";