import React from 'react';

const ProjeHubLogo = ({ size = "w-10 h-10" }) => {
  return (
    <div className={`${size} relative flex items-center justify-center group`}>
      {/* Background shape with gradient and animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-600 rounded-xl shadow-lg transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"></div>
      
      {/* Icon Content - Abstract Hub/P shape */}
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        className="relative w-3/5 h-3/5 text-white drop-shadow-md transform transition-transform duration-300 group-hover:scale-110"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main P/Hub stem */}
        <path 
          d="M6 5C6 3.89543 6.89543 3 8 3H14C17.3137 3 20 5.68629 20 9C20 12.3137 17.3137 15 14 15H8V21" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {/* Connection node logic */}
        <circle cx="14" cy="9" r="2" fill="currentColor" />
        <path d="M6 15H8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export default ProjeHubLogo;
