import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { config } from '../config';

const userPool = new CognitoUserPool({
  UserPoolId: config.userPoolId,
  ClientId: config.userPoolClientId,
});

export interface SignUpInput {
  email: string;
  password: string;
  phoneNumber: string;
  name: string;
  nickname: string;
}

export function signUp(input: SignUpInput): Promise<void> {
  const attributes = [
    new CognitoUserAttribute({ Name: 'email', Value: input.email }),
    new CognitoUserAttribute({ Name: 'phone_number', Value: input.phoneNumber }),
    new CognitoUserAttribute({ Name: 'custom:name', Value: input.name }),
    new CognitoUserAttribute({ Name: 'custom:nickname', Value: input.nickname }),
  ];

  return new Promise((resolve, reject) => {
    userPool.signUp(input.email, input.password, attributes, [], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  const authDetails = new AuthenticationDetails({ Username: email, Password: password });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut(): void {
  userPool.getCurrentUser()?.signOut();
}

export function getCurrentSession(): Promise<CognitoUserSession | null> {
  const user = userPool.getCurrentUser();
  if (!user) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(session);
    });
  });
}
