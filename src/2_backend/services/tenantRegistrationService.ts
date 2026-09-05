import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from './firebaseConfig';

const functions = getFunctions(firebaseApp);

export async function selfRegisterTenant(data: {
  roomId: string;
  name: string;
  phone: string;
  moveInDate: string;
}): Promise<void> {
  const call = httpsCallable(functions, 'selfRegisterTenant');
  await call(data);
}