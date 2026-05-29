function ActionButton({ icon: Icon, variant = 'secondary', onClick, label, disabled, className = '', children, ...rest }) {
  return (
    <button
      className={`btn-action btn-action--${variant}${className ? ' ' + className : ''}`}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {Icon && <Icon size={16} />}
      {label || children}
    </button>
  );
}

export default ActionButton;
