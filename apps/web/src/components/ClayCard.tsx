import React from 'react';

interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'hero' | 'small' | 'flat';
  className?: string;
  children: React.ReactNode;
}

export const ClayCard: React.FC<ClayCardProps> = ({
  variant = 'hero',
  className = '',
  children,
  ...props
}) => {
  const baseClass =
    variant === 'hero' ? 'clay' : variant === 'small' ? 'clay-sm' : 'clay-flat';

  return (
    <div
      className={`${baseClass} p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
