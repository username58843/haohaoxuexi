import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';

const ButtonCheckboxGroup = (props) => {
  const {
    size, color, options, selected, onChange, disabled
  } = props;

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([value, ...selected]);
    }
  };

  return (
    <div className="d-flex flex-wrap gap-2">
      {
        options.map((option) => (
          <Button
            key={option.value}
            color={selected.includes(option.value) ? color : 'outline-' + color}
            disabled={disabled}
            active={selected.includes(option.value)}
            onClick={() => toggle(option.value)}
            size={size}
            className="btn-checkbox"
          >
            {option.label}
          </Button>
        ))
      }
    </div>
  );
};

ButtonCheckboxGroup.propTypes = {
  options: PropTypes.array.isRequired,
  selected: PropTypes.array,
  disabled: PropTypes.bool,
  size: PropTypes.string,
  color: PropTypes.string,
  onChange: PropTypes.func
};

ButtonCheckboxGroup.defaultProps = {
  size: 'md',
  color: 'primary',
  disabled: false,
  selected: [],
  onChange: () => {}
};

export default ButtonCheckboxGroup;
