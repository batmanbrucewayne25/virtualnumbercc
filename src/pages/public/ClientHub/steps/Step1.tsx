import { useState } from "react";

interface Step1Props {
  resellerId: string;
  onSignUp: () => void;
  onLogin: () => void;
}

const Step1 = ({ resellerId, onSignUp, onLogin }: Step1Props) => {
  return (
    <>
      <h4 className="mb-12">Welcome to Client Hub</h4>
      <p className="text-sm text-secondary-light mb-24">
        Get started by creating your account or logging in if you already have one.
      </p>

      <button 
        type="button"
        className="btn btn-primary w-100 radius-12 mb-12" 
        onClick={(e) => {
          e.preventDefault();
          onSignUp();
        }}
      >
        Sign Up
      </button>

      <button 
        type="button"
        className="btn btn-outline-primary w-100 radius-12" 
        onClick={(e) => {
          e.preventDefault();
          onLogin();
        }}
      >
        Login
      </button>
    </>
  );
};

export default Step1;

