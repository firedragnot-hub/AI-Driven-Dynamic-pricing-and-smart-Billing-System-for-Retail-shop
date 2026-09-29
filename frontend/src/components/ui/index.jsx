import React from 'react';
import { Loader2, AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const Button = React.forwardRef(({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size = 'md', // 'sm' | 'md' | 'lg' | 'icon'
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  style = {},
  onClick,
  type = 'button',
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${loading ? 'is-loading' : ''} ${className}`}
      style={style}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin ui-btn-spinner" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : 16} className="ui-btn-icon-left" />
      ) : null}
      <span className="ui-btn-content">{children}</span>
      {!loading && IconRight && (
        <IconRight size={size === 'sm' ? 14 : 16} className="ui-btn-icon-right" />
      )}
    </button>
  );
});

export const Input = React.forwardRef(({
  label,
  error,
  helperText,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  containerStyle = {},
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div className={`ui-input-group ${className}`} style={containerStyle}>
      {label && <label htmlFor={inputId} className="ui-input-label">{label}</label>}
      <div className={`ui-input-wrapper ${error ? 'has-error' : ''}`}>
        {Icon && <Icon size={16} className="ui-input-icon-left" />}
        <input
          ref={ref}
          id={inputId}
          className={`ui-input ${Icon ? 'with-left-icon' : ''} ${IconRight ? 'with-right-icon' : ''}`}
          {...props}
        />
        {IconRight && <IconRight size={16} className="ui-input-icon-right" />}
      </div>
      {error && <span className="ui-input-error"><AlertCircle size={12} /> {error}</span>}
      {!error && helperText && <span className="ui-input-helper">{helperText}</span>}
    </div>
  );
});

export const Card = ({
  children,
  title,
  subtitle,
  action,
  headerBorder = false,
  className = '',
  style = {},
  onClick,
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={`ui-card ${hoverable ? 'ui-card-hoverable' : ''} ${className}`}
      style={style}
      onClick={onClick}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className={`ui-card-header ${headerBorder ? 'with-border' : ''}`}>
          <div>
            {title && <h3 className="ui-card-title">{title}</h3>}
            {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="ui-card-action">{action}</div>}
        </div>
      )}
      <div className="ui-card-body">{children}</div>
    </div>
  );
};

export const Badge = ({
  children,
  variant = 'neutral', // 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
  size = 'md', // 'sm' | 'md'
  icon: Icon,
  className = '',
  style = {},
}) => {
  return (
    <span className={`ui-badge ui-badge-${variant} ui-badge-${size} ${className}`} style={style}>
      {Icon && <Icon size={size === 'sm' ? 10 : 12} className="ui-badge-icon" />}
      <span>{children}</span>
    </span>
  );
};

export const StatCard = ({
  title,
  value,
  subtext,
  trend, // 'up' | 'down' | 'neutral'
  trendValue,
  icon: Icon,
  accentColor = 'var(--brand-primary)',
  onClick,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`ui-stat-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ ...style, '--card-accent': accentColor }}
      onClick={onClick}
    >
      <div className="ui-stat-header">
        <span className="ui-stat-title">{title}</span>
        {Icon && (
          <div className="ui-stat-icon-wrap" style={{ color: accentColor, background: `${accentColor}18` }}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="ui-stat-value">{value}</div>
      {(subtext || trendValue) && (
        <div className="ui-stat-footer">
          {trendValue && (
            <span className={`ui-stat-trend trend-${trend || 'neutral'}`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}
            </span>
          )}
          {subtext && <span className="ui-stat-subtext">{subtext}</span>}
        </div>
      )}
    </div>
  );
};

export const EmptyState = ({
  icon: Icon = AlertCircle,
  title = 'No Data Found',
  description = 'There are no items to display at this moment.',
  action,
  className = '',
  style = {}
}) => {
  return (
    <div className={`ui-empty-state ${className}`} style={style}>
      <div className="ui-empty-icon-wrap">
        <Icon size={36} />
      </div>
      <h3 className="ui-empty-title">{title}</h3>
      <p className="ui-empty-desc">{description}</p>
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
};

export const Skeleton = ({
  variant = 'text', // 'text' | 'rect' | 'circle'
  width,
  height,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`ui-skeleton ui-skeleton-${variant} ${className}`}
      style={{ width, height, ...style }}
    />
  );
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '550px',
  className = ''
}) => {
  if (!isOpen) return null;

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div
        className={`ui-modal-container ${className}`}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal-header">
          <div>
            <h2 className="ui-modal-title">{title}</h2>
            {subtitle && <p className="ui-modal-subtitle">{subtitle}</p>}
          </div>
          <button className="ui-modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
