import React from 'react';
import LoginPageWeb from './LoginPage.jsx';

export default function SignUpPageWeb(props) {
  return <LoginPageWeb {...props} initialMode="signup" />;
}
