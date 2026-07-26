import React from 'react';
import PropTypes from 'prop-types';
import NextLink from 'next/link';

const Link = ({ children, href, className, style, ...props }) => {
  const basePath = process.env.base || '';
  const fullHref = `${basePath}${href}`;
  
  return (
    <NextLink
      href={fullHref}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </NextLink>
  );
};

Link.propTypes = {
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  href: PropTypes.string.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

export default Link;
