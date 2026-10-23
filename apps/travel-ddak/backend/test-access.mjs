export function approvedTravelTester(auth){
 const email=auth?.token?.email?.toLowerCase();
 return email==='eorngh@gmail.com'||(email==='travelddak-play-review@example.invalid'&&auth.uid==='travelddak-play-review-da35dc7b637f');
}
