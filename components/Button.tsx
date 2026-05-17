import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'info';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading = false, 
  icon,
  className = '',
  ...props 
}) => {
  const baseStyles = "relative inline-flex items-center justify-center px-6 py-3 overflow-hidden font-bold text-white transition-all duration-300 ease-out rounded-lg shadow-md group transform hover:-translate-y-0.5 hover:shadow-lg focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-500 hover:to-indigo-600",
    secondary: "bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800",
    success: "bg-emerald-500 hover:bg-emerald-600",
    info: "bg-sky-500 hover:bg-sky-600",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : icon ? (
        <span className="mr-2">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
