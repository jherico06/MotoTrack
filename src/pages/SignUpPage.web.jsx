import React from 'react';
import LoginPageWeb from './LoginPage.web';

export default function SignUpPageWeb(props) {
  return <LoginPageWeb {...props} initialMode="signup" />;
}
