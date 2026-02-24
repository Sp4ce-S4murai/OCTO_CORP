import React from 'react';

export const PanicIcon = ({ size = 24, className = "", strokeWidth = 2 }: { size?: number | string, className?: string, strokeWidth?: number | string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        {/* Head */}
        <circle cx="12" cy="7.5" r="2.5" />

        {/* Drops (rounded at top, pointy at bottom) */}
        <path d="M 12 4.5 C 10.8 3, 11.2 2, 12 2 C 12.8 2, 13.2 3, 12 4.5 Z" />
        <path d="M 12 4.5 C 10.8 3, 11.2 2, 12 2 C 12.8 2, 13.2 3, 12 4.5 Z" transform="rotate(-35 12 7.5)" />
        <path d="M 12 4.5 C 10.8 3, 11.2 2, 12 2 C 12.8 2, 13.2 3, 12 4.5 Z" transform="rotate(35 12 7.5)" />

        {/* Body Lines */}
        <path
            d="
            M 12 10 
            L 12 15 
            M 8.5 6.5 
            L 5 11.5 
            L 19 11.5 
            L 15.5 6.5
            M 12 15 
            C 7 15.5, 7 22, 9 22
            M 12 15 
            C 17 15.5, 17 22, 15 22
            "
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </svg>
);
