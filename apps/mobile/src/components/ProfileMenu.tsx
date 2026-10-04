import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../providers/AuthProvider';
import { viewName } from '../../../../shared/accountView';
import { Icon, Notice, colors, s } from './ui';
export function AccountHeader(){
  const {context,switchView,signOut}=useAuth();const insets=useSafeAreaInsets();const router=useRouter();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!context)return null;
  const views=context.availableContexts??[1];
  const change=async(next:1|2|3)=>{setBusy(true);setError('');try{await switchView(next);setOpen(false);router.replace('/(tabs)/community');}catch(e){setError(e instanceof Error?e.message:'Could not change view.');}finally{setBusy(false)}};
  return <View style={{backgroundColor:'white',borderBottomWidth:1,borderBottomColor:colors.line,paddingTop:insets.top}}>
    <View style={{height:64,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}><Pressable accessibilityRole="button" accessibilityLabel="CommunityHub home" onPress={()=>router.replace('/(tabs)/community')} style={{flexDirection:'row',gap:8,alignItems:'center'}}><Icon name="business" color={colors.teal}/><Text style={{fontWeight:'800',fontSize:17,color:colors.ink}}>CommunityHub</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open profile menu" accessibilityState={{expanded:open}} onPress={()=>setOpen(true)} style={{flexDirection:'row',alignItems:'center',gap:6,minHeight:44}}><View style={{backgroundColor:colors.lavender,borderRadius:18,padding:9}}><Icon name="person-outline" size={19}/></View><Icon name="chevron-down" size={14}/></Pressable></View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><Pressable accessibilityLabel="Close profile menu" onPress={()=>setOpen(false)} style={{flex:1,backgroundColor:'#142b351f',alignItems:'flex-end',paddingTop:insets.top+70,paddingHorizontal:14}}><Pressable accessibilityViewIsModal onPress={()=>{}} style={{backgroundColor:'white',width:280,borderRadius:18,borderWidth:1,borderColor:colors.line,padding:18,gap:12}}><Text style={s.h3}>{context.displayName||'Your account'}</Text><Text style={s.small}>{context.email}</Text><Text style={s.label}>{viewName(context.userContext??1)} view</Text><View style={s.divider}/>{views.length>1&&<><Text style={s.eyebrow}>SWITCH YOUR VIEW</Text>{views.map(next=><Pressable key={next} accessibilityRole="button" accessibilityState={{selected:context.userContext===next,disabled:busy}} disabled={busy} onPress={()=>void change(next)} style={{padding:13,flexDirection:'row',gap:10,alignItems:'center',borderRadius:10,backgroundColor:context.userContext===next?'#edf5e7':'white'}}><Icon name={next===2?'shield-checkmark-outline':next===3?'storefront-outline':'person-outline'} size={18}/><Text style={[s.label,{flex:1}]}>{viewName(next)} view</Text>{context.userContext===next&&<Icon name="checkmark" size={18}/>}</Pressable>)}</>}<Pressable accessibilityRole="button" onPress={()=>{setOpen(false);router.replace('/(tabs)/community')}} style={{padding:12}}><Text style={s.link}>Go to your home</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>void signOut().catch(()=>setError('Could not sign out.'))} style={{padding:12}}><Text style={s.link}>Sign out</Text></Pressable>{error&&<Notice message={error} danger/>}</Pressable></Pressable></Modal>
  </View>;
}

