import {HttpClient} from '@angular/common/http';
import {Component, ViewChild, AfterViewInit} from '@angular/core';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {merge, Observable, of as observableOf} from 'rxjs';
import {catchError, map, startWith, switchMap, debounceTime} from 'rxjs/operators';
import { Patient } from 'src/app/common/patient';
import {MatDatepickerInputEvent} from '@angular/material/datepicker';

/**
 * @title Table retrieving data through HTTP using Django Rest API
 */
@Component({
  selector: 'dynamictable',
  styleUrls: ['dynamictable.css'],
  templateUrl: 'dynamictable.component.html',
})

export class DynamictableComponent implements AfterViewInit {

  displayedColumns: string[] = ['name', 'sampling_date', 'group', 'birthday'];
  Database: HttpDatabase | null;
  data: Patient[] = [];

  resultsLength = 0;
  resultsPerPage = 0;
  isLoadingResults = true;
  isRateLimitReached = false;

  searchQuery = '';
  href = 'http://127.0.0.1:8000/patients';


  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private _httpClient: HttpClient) {}


  applyFilter(event: Event)  {
    this.searchQuery = (event.target as HTMLInputElement).value.toLowerCase();
    if (this.searchQuery.length<3) {this.paginator.pageIndex = 0;}
    this.requestDataFromApi(1000);
  }

  applyDateFilter(event: MatDatepickerInputEvent<Date>){

    // convert to short ISOString in order to be postable to the Backend API
    this.searchQuery = event.value.toISOString().substring(0, 10);

    if(typeof this.searchQuery!='undefined' && this.searchQuery){
      this.requestDataFromApi(1000);
    }
  }
  // refresh action
  refresh(){
    this.searchQuery = '';
    this.requestDataFromApi(1000);
  }

  ngAfterViewInit() {

    this.Database = new HttpDatabase(this._httpClient);
    // If the user changes the sort order, reset back to the first page.
    this.sort.sortChange.subscribe(() => this.paginator.pageIndex = 0);

    this.requestDataFromApi(1000);
  }

  // request Data from the API with a debouncer

  requestDataFromApi(debouncer: number){
    merge(this.sort.sortChange, this.paginator.page)
    .pipe(
      startWith({}),
  
      switchMap(() => {
        this.isLoadingResults = true;
        return this.Database!.getPatients(
          this.sort.active, this.sort.direction, this.paginator.pageIndex, this.searchQuery);
      }), 
      debounceTime(debouncer),
      map(data => {
        // Flip flag to show that loading has finished.
        this.isLoadingResults = false;
        this.isRateLimitReached = false;
        this.resultsLength = data.count;
        this.resultsPerPage = data.results.length;
        return data.results;
      }),
      catchError(() => {
        this.isLoadingResults = false;
        // Catch if the GitHub API has reached its rate limit. Return empty data.
        this.isRateLimitReached = true;
        return observableOf([]);
      })
    ).subscribe(data => this.data = data);
  }
}

// configure the item API
// results and count parameters depends on the structure of your JSON

export interface PatientApi {
  results: Patient[];
  count: number;
}


export class HttpDatabase {

  constructor(private _httpClient: HttpClient) {}
  
  href = 'http://127.0.0.1:8000/patients';

  getPatients(sort: string, order: string, page: number, search: string): Observable<PatientApi> {
    
    const requestUrl = 
        `${this.href}/?page=${page + 1}&search=${search}`;
    return this._httpClient.get<PatientApi>(requestUrl);
    
  }
}
